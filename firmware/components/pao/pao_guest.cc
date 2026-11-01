#include "pao_guest.h"

#include "wasm_export.h"

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <pthread.h>
#include <cstdio>
#include <cstring>

namespace {
constexpr char kTag[] = "PaoGuest";

extern const uint8_t guest_wasm_start[] asm("_binary_guest_wasm_start");
extern const uint8_t guest_wasm_end[] asm("_binary_guest_wasm_end");

pao_guest_hooks_t g_hooks;

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

void HostFire(wasm_exec_env_t env) {
    (void)env;
    if (g_hooks.fire != nullptr) {
        g_hooks.fire();
    }
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
    {"fire", reinterpret_cast<void*>(HostFire), "()", nullptr},
    {"show_distance", reinterpret_cast<void*>(HostShowDistance), "(i)", nullptr},
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

extern "C" void pao_guest_start(void) {
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setstacksize(&attr, 64 * 1024);
    pthread_t thread;
    if (pthread_create(&thread, &attr, GuestTask, nullptr) != 0) {
        ESP_LOGE(kTag, "pthread_create failed");
    }
}
