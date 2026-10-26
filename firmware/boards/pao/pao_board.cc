#include "wifi_board.h"
#include "application.h"
#include "button.h"
#include "chassis.h"
#include "codecs/no_audio_codec.h"
#include "config.h"
#include "control_page.h"
#include "display/oled_display.h"
#include "forward_distance_mover.h"
#include "hc_sr04.h"
#include "launcher.h"
#include "led/single_led.h"
#include "mcp_server.h"
#include "motor.h"
#include "pao.h"

#include <driver/i2c_master.h>
#include <esp_check.h>
#include <esp_http_server.h>
#include <esp_lcd_panel_vendor.h>
#include <esp_log.h>
#include <esp_timer.h>
#include <freertos/task.h>
#include <nvs.h>
#include <wifi_manager.h>

#include <atomic>
#include <cmath>
#include <cstdlib>
#include <cstdint>
#include <cstring>
#include <mutex>
#include <string_view>

#define TAG "PaoBoard"

namespace {
constexpr char kMotionNamespace[] = "pao_motion";
constexpr char kMotionKey[] = "config";
constexpr char kMotionOutputKey[] = "motion_output";
constexpr uint32_t kMotionConfigVersion = 4;

// 保持旧版 NVS 的字段布局，以恢复仍在使用的最大输出和左右轮比例。
struct StoredMotionConfigV1 {
    uint32_t version;
    uint32_t ramp_time_ms;
    float left_scale;
    float right_scale;
};

struct StoredMotionConfigV2 {
    uint32_t version;
    uint32_t ramp_time_ms;
    float left_scale;
    float right_scale;
    float move_output;
    float rotate_output;
};

struct StoredMotionConfigV3 {
    uint32_t version;
    uint32_t ramp_time_ms;
    float left_scale;
    float right_scale;
    float move_output;
    float rotate_output;
    float min_output;
};

struct StoredMotionConfig {
    uint32_t version;
    ChassisConfig config;
};

struct LegacyMotionOutput {
    uint8_t move_output = 80;
    uint8_t rotate_output = 80;
};
}  // namespace

extern const char pao_launch_start[] asm("_binary_pao_launch_ogg_start");
extern const char pao_launch_end[] asm("_binary_pao_launch_ogg_end");

class PaoBoard : public WifiBoard {
private:
    enum class MotionAction { Forward, Backward, TurnLeft, TurnRight, Stop, EmergencyStop };

    Button boot_button_{BOOT_BUTTON_GPIO};
    Motor right_motor_{MOTOR_GPIO_IN1, MOTOR_GPIO_IN2};
    // 左轮安装方向与右轮相反，交换输入使正速度均表示车体前进。
    Motor left_motor_{MOTOR_GPIO_IN4, MOTOR_GPIO_IN3};
    Chassis chassis_{left_motor_, right_motor_};
    esp_timer_handle_t chassis_timer_ = nullptr;
    std::mutex chassis_mutex_;
    std::mutex motion_config_mutex_;
    int64_t chassis_deadline_ = 0;
    Launcher launcher_{LAUNCHER_GPIO_FIRE};
    HcSr04 ultrasonic_{ULTRASONIC_GPIO_TRIG, ULTRASONIC_GPIO_ECHO};
    ForwardDistanceMover distance_mover_{ultrasonic_, chassis_};
    TaskHandle_t distance_task_ = nullptr;
    uint32_t chassis_generation_ = 0;
    esp_timer_handle_t standby_timer_ = nullptr;
    std::atomic<int64_t> standby_started_{0};
    std::atomic<bool> standby_reply_heard_{false};
    httpd_handle_t control_server_ = nullptr;
    i2c_master_bus_handle_t display_i2c_bus_ = nullptr;
    esp_lcd_panel_io_handle_t display_panel_io_ = nullptr;
    esp_lcd_panel_handle_t display_panel_ = nullptr;
    Display* display_ = nullptr;

    // 续发指令只取消旧任务和定时器，保持当前电机输出。
    // 调用方持有 chassis_mutex_，使旧测距结果和旧定时回调不能恢复已取消的运动。
    void ResetMotionLocked(const char* status) {
        chassis_deadline_ = 0;
        ++chassis_generation_;
        if (status != nullptr) {
            distance_mover_.cancel(status);
        }
        const auto error = esp_timer_stop(chassis_timer_);
        if (error != ESP_ERR_INVALID_STATE) {
            ESP_ERROR_CHECK(error);
        }
    }

    void StopChassisLocked(const char* status) {
        chassis_.emergencyStop();
        ResetMotionLocked(status);
    }

    uint32_t StopChassis() {
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        StopChassisLocked(distance_mover_.status().active ? "cancelled" : "idle");
        return chassis_generation_;
    }

    static bool ParseMotionAction(std::string_view name, MotionAction& action) {
        if (name == "forward") { action = MotionAction::Forward; }
        else if (name == "backward") { action = MotionAction::Backward; }
        else if (name == "turn_left") { action = MotionAction::TurnLeft; }
        else if (name == "turn_right") { action = MotionAction::TurnRight; }
        else if (name == "stop") { action = MotionAction::Stop; }
        else if (name == "emergency_stop") { action = MotionAction::EmergencyStop; }
        else { return false; }
        return true;
    }

    void RunChassis(MotionAction action, int duration_ms = 0) {
        static constexpr const char* kActionNames[] = {
            "forward", "backward", "turn_left", "turn_right", "stop", "emergency_stop"
        };
        if (action == MotionAction::EmergencyStop) {
            StopChassis();
            ESP_LOGI(TAG, "Chassis stopped: emergency_stop");
            return;
        }
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        ResetMotionLocked(distance_mover_.status().active ? "cancelled" : "idle");
        if (action == MotionAction::Stop) {
            chassis_.stop();
            ESP_LOGI(TAG, "Chassis stopped: stop");
            return;
        }
        if (duration_ms > 0) {
            const int64_t duration_us = static_cast<int64_t>(duration_ms) * 1000;
            chassis_deadline_ = esp_timer_get_time() + duration_us;
            ESP_ERROR_CHECK(esp_timer_start_once(chassis_timer_, duration_us));
        }
        switch (action) {
        case MotionAction::Forward: chassis_.forward(); break;
        case MotionAction::Backward: chassis_.backward(); break;
        case MotionAction::TurnLeft: chassis_.turnLeft(); break;
        case MotionAction::TurnRight: chassis_.turnRight(); break;
        case MotionAction::Stop:
        case MotionAction::EmergencyStop: break;
        }
        ESP_LOGI(TAG, "Chassis action=%s duration_ms=%d", kActionNames[static_cast<int>(action)], duration_ms);
    }

    void LoadMotionConfig() {
        nvs_handle_t handle;
        const auto opened = nvs_open(kMotionNamespace, NVS_READONLY, &handle);
        if (opened == ESP_ERR_NVS_NOT_FOUND) {
            return;
        }
        if (opened != ESP_OK) {
            ESP_LOGW(TAG, "Cannot open motion config: %s", esp_err_to_name(opened));
            return;
        }
        size_t size = 0;
        const auto error = nvs_get_blob(handle, kMotionKey, nullptr, &size);
        if (error == ESP_OK && size == sizeof(StoredMotionConfig)) {
            StoredMotionConfig saved = {};
            if (nvs_get_blob(handle, kMotionKey, &saved, &size) != ESP_OK ||
                saved.version != kMotionConfigVersion || !chassis_.setConfig(saved.config)) {
                ESP_LOGW(TAG, "Invalid motion config; using defaults");
            }
        } else if (error == ESP_OK && size == sizeof(StoredMotionConfigV3)) {
            StoredMotionConfigV3 saved = {};
            ChassisConfig config;
            if (nvs_get_blob(handle, kMotionKey, &saved, &size) == ESP_OK && saved.version == 3) {
                config.left_scale = saved.left_scale;
                config.right_scale = saved.right_scale;
                config.move_output = saved.move_output;
                config.rotate_output = saved.rotate_output;
                if (!chassis_.setConfig(config)) {
                    ESP_LOGW(TAG, "Invalid motion config; using defaults");
                }
            } else {
                ESP_LOGW(TAG, "Invalid motion config; using defaults");
            }
        } else if (error == ESP_OK && size == sizeof(StoredMotionConfigV2)) {
            StoredMotionConfigV2 saved = {};
            ChassisConfig config;
            if (nvs_get_blob(handle, kMotionKey, &saved, &size) == ESP_OK && saved.version == 2) {
                config.left_scale = saved.left_scale;
                config.right_scale = saved.right_scale;
                config.move_output = saved.move_output;
                config.rotate_output = saved.rotate_output;
                if (!chassis_.setConfig(config)) {
                    ESP_LOGW(TAG, "Invalid motion config; using defaults");
                }
            } else {
                ESP_LOGW(TAG, "Invalid motion config; using defaults");
            }
        } else if (error == ESP_OK && size == sizeof(StoredMotionConfigV1)) {
            StoredMotionConfigV1 saved = {};
            if (nvs_get_blob(handle, kMotionKey, &saved, &size) == ESP_OK && saved.version == 1) {
                ChassisConfig config;
                config.left_scale = saved.left_scale;
                config.right_scale = saved.right_scale;
                LegacyMotionOutput output;
                size = sizeof(output);
                if (nvs_get_blob(handle, kMotionOutputKey, &output, &size) == ESP_OK &&
                    size == sizeof(output) && output.move_output >= 20 && output.move_output <= 100 &&
                    output.rotate_output >= 20 && output.rotate_output <= 100) {
                    config.move_output = output.move_output / 100.0f;
                    config.rotate_output = output.rotate_output / 100.0f;
                }
                if (!chassis_.setConfig(config)) {
                    ESP_LOGW(TAG, "Invalid motion config; using defaults");
                }
            } else {
                ESP_LOGW(TAG, "Invalid motion config; using defaults");
            }
        } else if (error != ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGW(TAG, "Invalid motion config; using defaults");
        }
        nvs_close(handle);
    }

    esp_err_t SaveMotionConfig(const ChassisConfig& config) {
        if (!Chassis::validConfig(config)) {
            return ESP_ERR_INVALID_ARG;
        }
        std::lock_guard<std::mutex> lock(motion_config_mutex_);
        const auto current = chassis_.config();
        if (current.left_scale == config.left_scale && current.right_scale == config.right_scale &&
            current.move_output == config.move_output && current.rotate_output == config.rotate_output) {
            return ESP_OK;
        }
        nvs_handle_t handle;
        auto error = nvs_open(kMotionNamespace, NVS_READWRITE, &handle);
        if (error != ESP_OK) {
            return error;
        }
        const StoredMotionConfig saved = {kMotionConfigVersion, config};
        error = nvs_set_blob(handle, kMotionKey, &saved, sizeof(saved));
        if (error == ESP_OK) {
            error = nvs_commit(handle);
        }
        nvs_close(handle);
        if (error == ESP_OK) {
            chassis_.setConfig(config);
        }
        return error;
    }

    ToolResult MoveForward(int distance_cm) {
        const auto generation = StopChassis();
        float initial_cm = 0;
        const auto error = distance_mover_.readDistanceCm(initial_cm);
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        if (generation != chassis_generation_) {
            return std::unexpected("运动已被新的底盘指令取消");
        }
        if (error != ESP_OK) {
            distance_mover_.cancel("sensor_error");
            return std::unexpected(std::string("起始测距失败，未启动电机：") + esp_err_to_name(error));
        }
        if (!distance_mover_.forwardCm(distance_cm, initial_cm)) {
            return std::unexpected("前方空间不足：目标位置须保留至少 10cm 距离，未启动电机");
        }
        chassis_deadline_ = esp_timer_get_time() + 15000000;
        ESP_ERROR_CHECK(esp_timer_start_once(chassis_timer_, 15000000));
        xTaskNotifyGive(distance_task_);
        ESP_LOGI(TAG, "Distance move started: requested=%dcm initial=%.1fcm", distance_cm, initial_cm);
        return std::string("已开始按超声波距离反馈前进，尚未完成；可调用 self.ultrasonic.get_distance 查询进度和停止原因");
    }

    void RunDistanceControl() {
        while (true) {
            ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
            while (true) {
                uint32_t generation;
                {
                    std::lock_guard<std::mutex> lock(chassis_mutex_);
                    if (!distance_mover_.status().active) {
                        break;
                    }
                    generation = chassis_generation_;
                }
                float current_cm = 0;
                // 驱动负责 >=60ms 采样间隔；等待回波时不能持有底盘锁，急停仍可立即执行。
                const auto error = distance_mover_.readDistanceCm(current_cm);
                {
                    std::lock_guard<std::mutex> lock(chassis_mutex_);
                    if (generation != chassis_generation_ || !distance_mover_.status().active) {
                        continue;
                    }
                    distance_mover_.update(error, current_cm);
                    const auto state = distance_mover_.status();
                    if (!state.active) {
                        ResetMotionLocked(nullptr);
                        ESP_LOGI(TAG, "Distance move stopped: %s moved=%.1fcm requested=%dcm",
                                 state.motion_status, state.moved_cm, state.requested_cm);
                    }
                }
                // 测距锁释放后让出一个 tick，避免连续重抢导致进度查询一直等到运动结束。
                vTaskDelay(1);
            }
        }
    }

    void InitializeChassisTools() {
        esp_timer_create_args_t timer = {};
        timer.arg = this;
        timer.name = "chassis_stop";
        timer.callback = [](void* arg) {
            auto* board = static_cast<PaoBoard*>(arg);
            std::lock_guard<std::mutex> lock(board->chassis_mutex_);
            // 已排队的旧定时回调不能中断刚收到的新运动指令。
            if (board->chassis_deadline_ != 0 && esp_timer_get_time() >= board->chassis_deadline_) {
                board->StopChassisLocked(board->distance_mover_.status().active ? "timeout" : "idle");
                ESP_LOGI(TAG, "Chassis stopped: duration elapsed");
            }
        };
        ESP_ERROR_CHECK(esp_timer_create(&timer, &chassis_timer_));
        LoadMotionConfig();
        if (xTaskCreate([](void* arg) {
                static_cast<PaoBoard*>(arg)->RunDistanceControl();
            }, "distance_move", 4096, this, 5, &distance_task_) != pdPASS) {
            ESP_ERROR_CHECK(ESP_ERR_NO_MEM);
        }

        auto& mcp = McpServer::GetInstance();
        // MCP Property 目前没有 enum schema，回调严格校验六种 action 值。
        mcp.AddTool("self.chassis.control",
            "控制两轮底盘。action 必填，只能是 forward（前进）、backward（后退）、"
            "turn_left（逆时针左转）、turn_right（顺时针右转）、stop（立即清零）、"
            "emergency_stop（立即清零输出）之一。"
            "四个方向动作使用设备保存的对应最大输出；duration_ms 可选，100..15000 毫秒，"
            "默认 1000，到时立即停；两个停止动作忽略 duration_ms。"
            "输出不是实测速度，不能保证准确距离或角度。"
            "新动作取消原有定时或按距离运动。前进指定厘米数请用 self.chassis.move_forward。",
            PropertyList({Property("action", kPropertyTypeString).SetMaxLength(14),
                          Property("duration_ms", kPropertyTypeInteger, 1000, 100, 15000)}),
            [this](const PropertyList& properties) -> ToolResult {
                const auto& action = properties["action"].value<std::string>();
                const int duration_ms = properties["duration_ms"].value<int>();
                MotionAction parsed;
                if (!ParseMotionAction(action, parsed)) {
                    return std::unexpected("action 只支持 forward/backward/turn_left/turn_right/stop/emergency_stop");
                }
                RunChassis(parsed, duration_ms);
                return true;
            });
        mcp.AddTool("self.chassis.move_forward",
            "是什么：通过前方超声波距离变化反馈控制小车直行。用户要求前进多少厘米时调用。\n"
            "参数：distance_cm 必填整数 1..390；使用设备保存的前进最大输出。\n"
            "以前方同一静止反射物的起始距离减当前距离估算前进量，到达后停车；"
            "必须有稳定反射物，不支持空旷环境里程测量、倒退或转弯。"
            "目标位置必须保留至少 10cm；空间不足或起始测距失败直接报错且不启动。"
            "新底盘指令会替换旧运动；途中无回波、测距错误、前方不足 10cm 或超过 15 秒立即停止。"
            "受采样间隔和惯性影响，不能保证厘米级精度。\n"
            "返回：已开始，尚未完成；使用 self.ultrasonic.get_distance 查询进度及停止原因。",
            PropertyList({Property("distance_cm", kPropertyTypeInteger, 1, 390)}),
            [this](const PropertyList& properties) -> ToolResult {
                return MoveForward(properties["distance_cm"].value<int>());
            });
        mcp.AddTool("self.ultrasonic.get_distance",
            "是什么：读取小车前方 HC-SR04 超声波距离，单位厘米，量程 2..400cm。\n"
            "用户询问前方距离、障碍物距离或按厘米运动进度时调用。参数：无。\n"
            "返回 JSON：distance_cm（本次失败时为 null）、error（测距错误或 null）、motion_status、"
            "requested_cm、moved_cm（最近一次按距离运动的估算进度，可为负值）。"
            "motion_status 为 idle/moving/reached/obstacle/sensor_error/timeout/cancelled；"
            "只有 reached 表示按测距反馈达到目标。测距失败不能理解为前方没有障碍物。",
            PropertyList(),
            [this](const PropertyList&) -> ReturnValue {
                return ReadDistance();
            });
    }

    cJSON* ReadDistance() {
        float distance_cm = 0;
        const auto error = distance_mover_.readDistanceCm(distance_cm);
        auto* result = cJSON_CreateObject();
        if (error == ESP_OK) {
            cJSON_AddNumberToObject(result, "distance_cm", distance_cm);
            cJSON_AddNullToObject(result, "error");
        } else {
            cJSON_AddNullToObject(result, "distance_cm");
            cJSON_AddStringToObject(result, "error", esp_err_to_name(error));
        }
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        const auto state = distance_mover_.status();
        cJSON_AddStringToObject(result, "motion_status", state.motion_status);
        cJSON_AddNumberToObject(result, "requested_cm", state.requested_cm);
        cJSON_AddNumberToObject(result, "moved_cm", state.moved_cm);
        return result;
    }

    // 语音工具和网页遥控在不同任务里调用，Launcher 自身串行化继电器脉冲。
    void FireLauncher() {
        launcher_.fire();
        // 音频入队可能等待正在播放的语音，在主循环处理，避免阻塞遥控指令续发。
        Application::GetInstance().Schedule([]() {
            const auto size = reinterpret_cast<std::uintptr_t>(pao_launch_end) - reinterpret_cast<std::uintptr_t>(pao_launch_start);
            Application::GetInstance().PlaySound(std::string_view(pao_launch_start, size));
        });
        ESP_LOGI(TAG, "Launcher fired");
    }

    void InitializeLauncherTools() {
        McpServer::GetInstance().AddTool("self.launcher.fire",
            "是什么：小车上的电磁炮（电磁发射器），常供电并自动充能，固件只能按下它的发射按钮。\n"
            "能做什么：开炮，立即发射一次。用户说开炮、开火、发射、射击、打一发、biu 一下时调用。"
            "要连续开多炮就调用多次。没有充能或断电工具。\n"
            "参数：无。\n"
            "返回：true 表示已发射。",
            PropertyList(),
            [this](const PropertyList&) -> ReturnValue {
                FireLauncher();
                return true;
            });
    }

    void InitializeNetworkTools() {
        McpServer::GetInstance().AddTool("self.network.get_access_info",
            "是什么：查询小车当前的 IP 地址和网页后台访问地址。\n"
            "能做什么：用户问你的 IP 是多少、后台地址是什么、怎么打开遥控页面时调用，"
            "将返回的 IP 和完整后台地址告诉用户，后台需要在同一局域网内访问。\n"
            "参数：无。\n"
            "返回：当前 IP 地址和后台访问地址；未联网或后台未启动时返回错误。",
            PropertyList(),
            [this](const PropertyList&) -> ToolResult {
                auto& wifi = WifiManager::GetInstance();
                if (!wifi.IsConnected()) {
                    return std::unexpected("设备尚未连接 Wi-Fi，无法提供 IP 和后台访问地址。");
                }
                const auto ip = wifi.GetIpAddress();
                if (control_server_ == nullptr) {
                    return std::unexpected("设备 IP 地址：" + ip + "；网页后台未启动，暂时无法访问。");
                }
                return "IP 地址：" + ip + "\n后台访问地址：http://" + ip + "/";
            });
    }

    // 工具调用时回复还没播完，立即关闭会话会截断“好的，再见”。这里等回复播完再关闭；
    // 服务端没有回复时 3 s 后关闭，回复超过 20 s 时打断，整体 30 s 后放弃。
    void InitializeStandbyTool() {
        esp_timer_create_args_t timer = {};
        timer.arg = this;
        timer.name = "standby";
        timer.callback = [](void* arg) {
            auto* board = static_cast<PaoBoard*>(arg);
            auto& app = Application::GetInstance();
            const auto state = app.GetDeviceState();
            const int64_t elapsed_ms = (esp_timer_get_time() - board->standby_started_) / 1000;
            if (state == kDeviceStateSpeaking) {
                board->standby_reply_heard_ = true;
                if (elapsed_ms > 20000) {
                    app.ToggleChatState();
                }
                return;
            }
            if (state == kDeviceStateIdle) {
                esp_timer_stop(board->standby_timer_);
                ESP_LOGI(TAG, "Standby: idle");
                return;
            }
            if (state == kDeviceStateListening && (board->standby_reply_heard_ || elapsed_ms > 3000)) {
                app.ToggleChatState();
                esp_timer_stop(board->standby_timer_);
                ESP_LOGI(TAG, "Standby: conversation closed");
                return;
            }
            if (elapsed_ms > 30000) {
                esp_timer_stop(board->standby_timer_);
                ESP_LOGW(TAG, "Standby: gave up in state %d", static_cast<int>(state));
            }
        };
        ESP_ERROR_CHECK(esp_timer_create(&timer, &standby_timer_));

        McpServer::GetInstance().AddTool("self.standby",
            "是什么：让小车结束当前对话、回到待机状态。\n"
            "能做什么：等你这句回复播完后关闭对话，设备回到待机，之后需要再说“小炮小炮”或按键才会重新对话。"
            "不会停止底盘和电磁炮，需要时先调用对应的停止工具。"
            "用户说退下吧、休息吧、待机、没事了、再见、先这样、不聊了时调用。\n"
            "参数：无。\n"
            "返回：true 表示已安排回到待机。调用后用一句简短的告别回复用户。",
            PropertyList(),
            [this](const PropertyList&) -> ReturnValue {
                const auto error = esp_timer_stop(standby_timer_);
                if (error != ESP_ERR_INVALID_STATE) {
                    ESP_ERROR_CHECK(error);
                }
                standby_started_ = esp_timer_get_time();
                standby_reply_heard_ = false;
                ESP_ERROR_CHECK(esp_timer_start_periodic(standby_timer_, 200 * 1000));
                ESP_LOGI(TAG, "Standby requested");
                return true;
            });
    }

    // 读取查询参数中的整数；缺省时取 fallback，非整数或越界返回 false。
    static bool QueryInt(const char* query, const char* key, int fallback, int min, int max, int& out) {
        out = fallback;
        char value[16];
        const auto error = httpd_query_key_value(query, key, value, sizeof(value));
        if (error == ESP_ERR_NOT_FOUND) {
            return fallback >= min && fallback <= max;
        }
        if (error != ESP_OK) { return false; }
        char* end = nullptr;
        const long parsed = std::strtol(value, &end, 10);
        if (end == value || *end != '\0' || parsed < min || parsed > max) {
            return false;
        }
        out = static_cast<int>(parsed);
        return true;
    }

    static bool QueryFloat(const char* query, const char* key, float& out) {
        char value[24];
        if (httpd_query_key_value(query, key, value, sizeof(value)) != ESP_OK) {
            return false;
        }
        char* end = nullptr;
        out = std::strtof(value, &end);
        return end != value && *end == '\0' && std::isfinite(out) && out >= 0 && out <= 1;
    }

    std::string ControlCommand(const std::string& path, const char* query) {
        int duration_ms, distance_cm, move_output, rotate_output;
        if (path == "/api/chassis") {
            char name[20];
            MotionAction action;
            if (httpd_query_key_value(query, "action", name, sizeof(name)) != ESP_OK ||
                !ParseMotionAction(name, action)) {
                return "action 只支持 forward/backward/turn_left/turn_right/stop/emergency_stop";
            }
            if (action == MotionAction::Stop || action == MotionAction::EmergencyStop) {
                RunChassis(action);
            } else {
                if (!QueryInt(query, "duration_ms", 1000, 100, 15000, duration_ms)) {
                    return "duration_ms 取 100..15000";
                }
                RunChassis(action, duration_ms);
            }
        } else if (path == "/api/motion-config") {
            ChassisConfig config = chassis_.config();
            if (!QueryFloat(query, "left_scale", config.left_scale) ||
                !QueryFloat(query, "right_scale", config.right_scale) ||
                !QueryInt(query, "move_output", std::lround(config.move_output * 100), 20, 100, move_output) ||
                !QueryInt(query, "rotate_output", std::lround(config.rotate_output * 100), 20, 100, rotate_output)) {
                return "参数需为 left_scale/right_scale=0..1，move_output/rotate_output=20..100";
            }
            config.move_output = move_output / 100.0f;
            config.rotate_output = rotate_output / 100.0f;
            const auto saved = SaveMotionConfig(config);
            if (saved != ESP_OK) {
                ESP_LOGE(TAG, "Motion config save failed: %s", esp_err_to_name(saved));
                return "运动配置保存失败，请重试";
            }
        } else if (path == "/api/move_forward") {
            if (!QueryInt(query, "distance_cm", 20, 1, 390, distance_cm)) {
                return "distance_cm 取 1..390";
            }
            const auto result = MoveForward(distance_cm);
            if (!result) { return result.error(); }
        } else if (path == "/api/launcher/fire") {
            FireLauncher();
        } else {
            return "未知控制指令";
        }
        return {};
    }

    cJSON* ReadMotionConfig() {
        std::lock_guard<std::mutex> lock(motion_config_mutex_);
        const auto config = chassis_.config();
        auto* result = cJSON_CreateObject();
        cJSON_AddNumberToObject(result, "left_scale", config.left_scale);
        cJSON_AddNumberToObject(result, "right_scale", config.right_scale);
        cJSON_AddNumberToObject(result, "move_output", std::lround(config.move_output * 100));
        cJSON_AddNumberToObject(result, "rotate_output", std::lround(config.rotate_output * 100));
        return result;
    }

    static esp_err_t WebSocketControl(httpd_req_t* req) {
        if (req->method == HTTP_GET) { return ESP_OK; }
        httpd_ws_frame_t frame = {};
        ESP_RETURN_ON_ERROR(httpd_ws_recv_frame(req, &frame, 0), TAG, "Cannot read WebSocket frame");
        if (frame.type != HTTPD_WS_TYPE_TEXT || frame.len == 0 || frame.len > 512 || !frame.final) {
            return ESP_ERR_INVALID_ARG;
        }
        char payload[513] = {};
        frame.payload = reinterpret_cast<uint8_t*>(payload);
        ESP_RETURN_ON_ERROR(httpd_ws_recv_frame(req, &frame, frame.len), TAG, "Cannot read WebSocket payload");
        CJsonUniquePtr request(cJSON_ParseWithLengthOpts(payload, frame.len + 1, nullptr, true));
        const auto* id = cJSON_GetObjectItemCaseSensitive(request.get(), "id");
        const auto* path = cJSON_GetObjectItemCaseSensitive(request.get(), "path");
        const auto* query = cJSON_GetObjectItemCaseSensitive(request.get(), "query");
        if (!cJSON_IsNumber(id) || id->valuedouble < 1 || id->valuedouble > 2147483647 ||
            id->valuedouble != id->valueint || !cJSON_IsString(path) || !cJSON_IsString(query) ||
            std::strlen(path->valuestring) > 64 || std::strlen(query->valuestring) > 127) {
            return ESP_ERR_INVALID_ARG;
        }
        auto* board = static_cast<PaoBoard*>(req->user_ctx);
        CJsonUniquePtr response(cJSON_CreateObject());
        cJSON_AddNumberToObject(response.get(), "id", id->valueint);
        std::string error;
        if (std::strcmp(path->valuestring, "/api/motion-config") == 0 && query->valuestring[0] == '\0') {
            cJSON_AddItemToObject(response.get(), "data", board->ReadMotionConfig());
        } else if (std::strcmp(path->valuestring, "/api/distance") == 0) {
            cJSON_AddItemToObject(response.get(), "data", board->ReadDistance());
        } else {
            error = board->ControlCommand(path->valuestring, query->valuestring);
            cJSON_AddBoolToObject(response.get(), "data", error.empty());
        }
        cJSON_AddBoolToObject(response.get(), "ok", error.empty());
        if (!error.empty()) { cJSON_AddStringToObject(response.get(), "error", error.c_str()); }
        CJsonStringUniquePtr text(cJSON_PrintUnformatted(response.get()));
        if (!text) { return ESP_ERR_NO_MEM; }
        frame.type = HTTPD_WS_TYPE_TEXT;
        frame.payload = reinterpret_cast<uint8_t*>(text.get());
        frame.len = std::strlen(text.get());
        return httpd_ws_send_frame(req, &frame);
    }

    // 局域网遥控页，参数范围与同名 MCP 工具一致；没有鉴权，只应在可信网络中使用。
    void StartControlServer() {
        if (control_server_ != nullptr) {
            return;
        }
        httpd_config_t config = HTTPD_DEFAULT_CONFIG();
        config.server_port = 80;
        config.ctrl_port = 32769;
        config.max_uri_handlers = 2;
        config.lru_purge_enable = true;
        if (httpd_start(&control_server_, &config) != ESP_OK) {
            ESP_LOGE(TAG, "Control server failed to start");
            control_server_ = nullptr;
            return;
        }
        const httpd_uri_t page = {
            "/", HTTP_GET, [](httpd_req_t* req) {
                httpd_resp_set_type(req, "text/html; charset=utf-8");
                httpd_resp_set_hdr(req, "Cache-Control", "no-store");
                return httpd_resp_sendstr(req, kControlPage);
            }, this,
        };
        ESP_ERROR_CHECK(httpd_register_uri_handler(control_server_, &page));
        httpd_uri_t websocket = {};
        websocket.uri = "/ws";
        websocket.method = HTTP_GET;
        websocket.handler = WebSocketControl;
        websocket.user_ctx = this;
        websocket.is_websocket = true;
        ESP_ERROR_CHECK(httpd_register_uri_handler(control_server_, &websocket));
        ESP_LOGI(TAG, "Control page: http://%s/", WifiManager::GetInstance().GetIpAddress().c_str());
    }

    esp_err_t InitializeDisplay() {
        i2c_master_bus_config_t bus_config = {};
        bus_config.i2c_port = I2C_NUM_0;
        bus_config.sda_io_num = DISPLAY_SDA_PIN;
        bus_config.scl_io_num = DISPLAY_SCL_PIN;
        bus_config.clk_source = I2C_CLK_SRC_DEFAULT;
        bus_config.glitch_ignore_cnt = 7;
        bus_config.flags.enable_internal_pullup = true;
        ESP_RETURN_ON_ERROR(i2c_new_master_bus(&bus_config, &display_i2c_bus_), TAG,
                            "Failed to create OLED I2C bus");
        ESP_RETURN_ON_ERROR(i2c_master_probe(display_i2c_bus_, DISPLAY_I2C_ADDRESS, 100), TAG,
                            "OLED not detected at 0x%02X", DISPLAY_I2C_ADDRESS);

        esp_lcd_panel_io_i2c_config_t io_config = {};
        io_config.dev_addr = DISPLAY_I2C_ADDRESS;
        io_config.scl_speed_hz = 400 * 1000;
        io_config.control_phase_bytes = 1;
        io_config.dc_bit_offset = 6;
        io_config.lcd_cmd_bits = 8;
        io_config.lcd_param_bits = 8;
        ESP_RETURN_ON_ERROR(esp_lcd_new_panel_io_i2c(display_i2c_bus_, &io_config, &display_panel_io_),
                            TAG, "Failed to create OLED panel IO");

        esp_lcd_panel_ssd1306_config_t ssd1306_config = {};
        ssd1306_config.height = DISPLAY_HEIGHT;
        esp_lcd_panel_dev_config_t panel_config = {};
        panel_config.reset_gpio_num = GPIO_NUM_NC;
        panel_config.bits_per_pixel = 1;
        panel_config.vendor_config = &ssd1306_config;
        ESP_RETURN_ON_ERROR(esp_lcd_new_panel_ssd1306(display_panel_io_, &panel_config, &display_panel_),
                            TAG, "Failed to create SSD1306 panel");
        ESP_RETURN_ON_ERROR(esp_lcd_panel_reset(display_panel_), TAG, "Failed to reset OLED");
        ESP_RETURN_ON_ERROR(esp_lcd_panel_init(display_panel_), TAG, "Failed to initialize OLED");
        ESP_RETURN_ON_ERROR(esp_lcd_panel_invert_color(display_panel_, false), TAG,
                            "Failed to configure OLED colors");
        ESP_RETURN_ON_ERROR(esp_lcd_panel_disp_on_off(display_panel_, true), TAG,
                            "Failed to turn on OLED");

        display_ = new OledDisplay(display_panel_io_, display_panel_, DISPLAY_WIDTH, DISPLAY_HEIGHT,
                                   DISPLAY_MIRROR_X, DISPLAY_MIRROR_Y);
        return ESP_OK;
    }

public:
    PaoBoard() {
        const auto error = InitializeDisplay();
        if (error != ESP_OK) {
            ESP_LOGW(TAG, "OLED unavailable (%s), continuing without display", esp_err_to_name(error));
            if (display_panel_ != nullptr) {
                esp_lcd_panel_del(display_panel_);
            }
            if (display_panel_io_ != nullptr) {
                esp_lcd_panel_io_del(display_panel_io_);
            }
            if (display_i2c_bus_ != nullptr) {
                i2c_del_master_bus(display_i2c_bus_);
            }
        }
        InitializeChassisTools();
        InitializeLauncherTools();
        InitializeNetworkTools();
        InitializeStandbyTool();
        boot_button_.OnClick([this]() {
            auto& app = Application::GetInstance();
            if (app.GetDeviceState() == kDeviceStateStarting) {
                EnterWifiConfigMode();
                return;
            }
            app.ToggleChatState();
        });
        pao_initialize();
    }

    void SetNetworkEventCallback(NetworkEventCallback callback) override {
        WifiBoard::SetNetworkEventCallback([this, callback = std::move(callback)](NetworkEvent event, const std::string& data) {
            if (event == NetworkEvent::Connected) {
                StartControlServer();
            }
            if (callback) {
                callback(event, data);
            }
        });
    }

    Display* GetDisplay() override {
        return display_ != nullptr ? display_ : WifiBoard::GetDisplay();
    }

    AudioCodec* GetAudioCodec() override {
        static NoAudioCodecSimplex codec(
            AUDIO_INPUT_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE,
            AUDIO_I2S_SPK_GPIO_BCLK, AUDIO_I2S_SPK_GPIO_LRCK, AUDIO_I2S_SPK_GPIO_DOUT,
            AUDIO_I2S_MIC_GPIO_SCK, AUDIO_I2S_MIC_GPIO_WS, AUDIO_I2S_MIC_GPIO_DIN);
        return &codec;
    }

    Led* GetLed() override {
        static SingleLed led(BUILTIN_LED_GPIO);
        return &led;
    }
};

DECLARE_BOARD(PaoBoard);
