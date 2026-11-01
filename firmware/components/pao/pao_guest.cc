#include "pao_guest.h"

#include "wasm_export.h"

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

#include <pthread.h>
#include <cstdio>
#include <cstring>

namespace {
constexpr char kTag[] = "PaoGuest";

extern const uint8_t guest_wasm_start[] asm("_binary_guest_wasm_start");
extern const uint8_t guest_wasm_end[] asm("_binary_guest_wasm_end");

pao_guest_hooks_t g_hooks;

struct GuestEvent {
    uint32_t id;
    int32_t type;
    int32_t arg0;
    int32_t arg1;
};

QueueHandle_t g_events;
SemaphoreHandle_t g_command_lock;
SemaphoreHandle_t g_reply_done;
volatile int32_t g_reply_result;
volatile uint32_t g_pending_id;
uint32_t g_next_id = 1;
GuestEvent g_current;
char g_last_text[512];

int32_t HostDistanceCm(wasm_exec_env_t env) {
    (void)env;
    return g_hooks.distance_cm != nullptr ? g_hooks.distance_cm() : -1;
}

void HostDelayMs(wasm_exec_env_t env, int32_t ms) {
    (void)env;
    if (ms > 0) {
        vTaskDelay(pdMS_TO_TICKS(ms));
    }
}

void HostLogInt(wasm_exec_env_t env, int32_t value) {
    (void)env;
    std::printf("[guest] %ld\n", static_cast<long>(value));
}

void HostMove(wasm_exec_env_t env, int32_t action, int32_t duration_ms) {
    (void)env;
    if (g_hooks.move != nullptr) {
        g_hooks.move(action, duration_ms);
    }
}

void HostMoveSequence(wasm_exec_env_t env, int32_t action, int32_t duration_ms) {
    (void)env;
    if (g_hooks.move_sequence != nullptr) {
        g_hooks.move_sequence(action, duration_ms);
    }
}

void HostFire(wasm_exec_env_t env) {
    (void)env;
    if (g_hooks.fire != nullptr) {
        g_hooks.fire();
    }
}

int32_t HostEventNext(wasm_exec_env_t env, int32_t timeout_ms) {
    (void)env;
    GuestEvent event;
    const TickType_t ticks = timeout_ms < 0 ? portMAX_DELAY : pdMS_TO_TICKS(timeout_ms);
    if (g_events == nullptr || xQueueReceive(g_events, &event, ticks) != pdTRUE) {
        return 0;
    }
    g_current = event;
    return event.type;
}

int32_t HostEventId(wasm_exec_env_t env) { (void)env; return static_cast<int32_t>(g_current.id); }
int32_t HostEventArg0(wasm_exec_env_t env) { (void)env; return g_current.arg0; }
int32_t HostEventArg1(wasm_exec_env_t env) { (void)env; return g_current.arg1; }

void HostEventReply(wasm_exec_env_t env, int32_t id, int32_t result) {
    (void)env;
    if (g_reply_done != nullptr && static_cast<uint32_t>(id) == g_pending_id) {
        g_reply_result = result;
        xSemaphoreGive(g_reply_done);
    }
}

int32_t HostTextLen(wasm_exec_env_t env) {
    (void)env;
    return static_cast<int32_t>(std::strlen(g_last_text));
}

int32_t HostTextByte(wasm_exec_env_t env, int32_t index) {
    (void)env;
    const auto length = static_cast<int32_t>(std::strlen(g_last_text));
    if (index < 0 || index >= length) {
        return 0;
    }
    return static_cast<uint8_t>(g_last_text[index]);
}

void HostShowReceivedText(wasm_exec_env_t env) {
    (void)env;
    if (g_hooks.show_text != nullptr) {
        g_hooks.show_text(g_last_text);
    }
}

void HostShowWake(wasm_exec_env_t env) {
    (void)env;
    if (g_hooks.show_wake != nullptr) {
        g_hooks.show_wake();
    }
}

void HostShowState(wasm_exec_env_t env, int32_t state) {
    (void)env;
    if (g_hooks.show_state != nullptr) {
        g_hooks.show_state(state);
    }
}

int32_t HostUptimeMs(wasm_exec_env_t env) {
    (void)env;
    return static_cast<int32_t>(esp_timer_get_time() / 1000);
}

int32_t HostDeviceState(wasm_exec_env_t env) {
    (void)env;
    return g_hooks.device_state != nullptr ? g_hooks.device_state() : -1;
}

void HostShowDistance(wasm_exec_env_t env, int32_t distance_cm) {
    (void)env;
    if (g_hooks.show_distance != nullptr) {
        g_hooks.show_distance(distance_cm);
    }
}

NativeSymbol kSymbols[] = {
    {"distance_cm", reinterpret_cast<void*>(HostDistanceCm), "()i", nullptr},
    {"delay_ms", reinterpret_cast<void*>(HostDelayMs), "(i)", nullptr},
    {"log_int", reinterpret_cast<void*>(HostLogInt), "(i)", nullptr},
    {"move", reinterpret_cast<void*>(HostMove), "(ii)", nullptr},
    {"move_seq", reinterpret_cast<void*>(HostMoveSequence), "(ii)", nullptr},
    {"fire", reinterpret_cast<void*>(HostFire), "()", nullptr},
    {"show_distance", reinterpret_cast<void*>(HostShowDistance), "(i)", nullptr},
    {"show_state", reinterpret_cast<void*>(HostShowState), "(i)", nullptr},
    {"show_wake", reinterpret_cast<void*>(HostShowWake), "()", nullptr},
    {"show_received_text", reinterpret_cast<void*>(HostShowReceivedText), "()", nullptr},
    {"text_len", reinterpret_cast<void*>(HostTextLen), "()i", nullptr},
    {"text_byte", reinterpret_cast<void*>(HostTextByte), "(i)i", nullptr},
    {"device_state", reinterpret_cast<void*>(HostDeviceState), "()i", nullptr},
    {"uptime_ms", reinterpret_cast<void*>(HostUptimeMs), "()i", nullptr},
    {"event_next", reinterpret_cast<void*>(HostEventNext), "(i)i", nullptr},
    {"event_id", reinterpret_cast<void*>(HostEventId), "()i", nullptr},
    {"event_arg0", reinterpret_cast<void*>(HostEventArg0), "()i", nullptr},
    {"event_arg1", reinterpret_cast<void*>(HostEventArg1), "()i", nullptr},
    {"event_reply", reinterpret_cast<void*>(HostEventReply), "(ii)", nullptr},
};

void* GuestTask(void*) {
    RuntimeInitArgs init_args;
    std::memset(&init_args, 0, sizeof(init_args));
    init_args.mem_alloc_type = Alloc_With_Allocator;
    init_args.mem_alloc_option.allocator.malloc_func = reinterpret_cast<void*>(malloc);
    init_args.mem_alloc_option.allocator.realloc_func = reinterpret_cast<void*>(realloc);
    init_args.mem_alloc_option.allocator.free_func = reinterpret_cast<void*>(free);

    if (!wasm_runtime_full_init(&init_args)) {
        ESP_LOGE(kTag, "wasm runtime init failed");
        return nullptr;
    }
    wasm_runtime_register_natives("pao", kSymbols, sizeof(kSymbols) / sizeof(kSymbols[0]));

    const auto size = static_cast<uint32_t>(guest_wasm_end - guest_wasm_start);
    auto* wasm = static_cast<uint8_t*>(
        heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (wasm == nullptr) {
        ESP_LOGE(kTag, "no memory for wasm image");
        return nullptr;
    }
    std::memcpy(wasm, guest_wasm_start, size);

    char error[160];
    wasm_module_t module = wasm_runtime_load(wasm, size, error, sizeof(error));
    if (module == nullptr) {
        ESP_LOGE(kTag, "load failed: %s", error);
        return nullptr;
    }
    wasm_module_inst_t instance = wasm_runtime_instantiate(module, 256 * 1024, 2 * 1024 * 1024,
                                                           error, sizeof(error));
    if (instance == nullptr) {
        ESP_LOGE(kTag, "instantiate failed: %s", error);
        return nullptr;
    }

    ESP_LOGI(kTag, "start guest (%u bytes)", static_cast<unsigned>(size));
    wasm_application_execute_main(instance, 0, nullptr);
    if (const char* exception = wasm_runtime_get_exception(instance)) {
        ESP_LOGE(kTag, "guest exception: %s", exception);
    }
    ESP_LOGI(kTag, "guest finished");

    wasm_runtime_deinstantiate(instance);
    wasm_runtime_unload(module);
    wasm_runtime_destroy();
    return nullptr;
}
}  // namespace

extern "C" void pao_guest_set_hooks(const pao_guest_hooks_t* hooks) {
    if (hooks != nullptr) {
        g_hooks = *hooks;
    }
}

extern "C" int pao_guest_post_event(int type, int arg0, int arg1) {
    if (g_events == nullptr) {
        return -1;
    }
    GuestEvent event = {0, type, arg0, arg1};
    return xQueueSend(g_events, &event, pdMS_TO_TICKS(100)) == pdTRUE ? 0 : -2;
}

extern "C" int pao_guest_post_text_event(int type, const char* text) {
    if (text == nullptr) {
        text = "";
    }
    std::snprintf(g_last_text, sizeof(g_last_text), "%s", text);
    return pao_guest_post_event(type, 0, 0);
}

extern "C" void pao_guest_on_stt_text(const char* text) {
    pao_guest_post_text_event(22, text);
}

extern "C" void pao_guest_on_device_state(int state) {
    pao_guest_post_event(21, state, 0);
}

extern "C" void pao_guest_on_wake_word(const char* word) {
    (void)word;
    pao_guest_post_event(20, 0, 0);
}

extern "C" int pao_guest_command_text(int type, const char* text) {
    if (g_events == nullptr || g_command_lock == nullptr) {
        return -1;
    }
    if (xSemaphoreTake(g_command_lock, pdMS_TO_TICKS(2000)) != pdTRUE) {
        return -2;
    }
    std::snprintf(g_last_text, sizeof(g_last_text), "%s", text != nullptr ? text : "");
    const uint32_t id = g_next_id++;
    g_pending_id = id;
    g_reply_result = -3;
    xSemaphoreTake(g_reply_done, 0);
    GuestEvent event = {id, type, 0, 0};
    if (xQueueSend(g_events, &event, pdMS_TO_TICKS(100)) != pdTRUE) {
        xSemaphoreGive(g_command_lock);
        return -4;
    }
    const bool replied = xSemaphoreTake(g_reply_done, pdMS_TO_TICKS(2000)) == pdTRUE;
    const int result = replied ? g_reply_result : -5;
    xSemaphoreGive(g_command_lock);
    return result;
}

extern "C" int pao_guest_command(int type, int arg0, int arg1) {
    if (g_events == nullptr || g_command_lock == nullptr) {
        return -1;
    }
    if (xSemaphoreTake(g_command_lock, pdMS_TO_TICKS(2000)) != pdTRUE) {
        return -2;
    }
    const uint32_t id = g_next_id++;
    g_pending_id = id;
    g_reply_result = -3;
    xSemaphoreTake(g_reply_done, 0);
    GuestEvent event = {id, type, arg0, arg1};
    if (xQueueSend(g_events, &event, pdMS_TO_TICKS(100)) != pdTRUE) {
        xSemaphoreGive(g_command_lock);
        return -4;
    }
    const bool replied = xSemaphoreTake(g_reply_done, pdMS_TO_TICKS(2000)) == pdTRUE;
    const int result = replied ? g_reply_result : -5;
    xSemaphoreGive(g_command_lock);
    return result;
}

extern "C" void pao_guest_start(void) {
    if (g_events == nullptr) {
        g_events = xQueueCreate(8, sizeof(GuestEvent));
        g_command_lock = xSemaphoreCreateMutex();
        g_reply_done = xSemaphoreCreateBinary();
    }
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setstacksize(&attr, 64 * 1024);
    pthread_t thread;
    if (pthread_create(&thread, &attr, GuestTask, nullptr) != 0) {
        ESP_LOGE(kTag, "pthread_create failed");
    }
}
