#include "wifi_board.h"
#include "application.h"
#include "button.h"
#include "chassis.h"
#include "codecs/no_audio_codec.h"
#include "config.h"
#include "control_page.h"
#include "display/oled_display.h"
#include "hc_sr04.h"
#include "launcher.h"
#include "led/single_led.h"
#include "mcp_server.h"
#include "motor.h"
#include "pao.h"
#include "settings.h"

#include <driver/i2c_master.h>
#include <esp_check.h>
#include <esp_http_server.h>
#include <esp_lcd_panel_vendor.h>
#include <esp_log.h>
#include <esp_timer.h>
#include <freertos/task.h>
#include <wifi_manager.h>

#include <atomic>
#include <cstdlib>
#include <cstdio>
#include <mutex>

#define TAG "PaoBoard"

class PaoBoard : public WifiBoard {
private:
    Button boot_button_{BOOT_BUTTON_GPIO};
    Motor right_motor_{MOTOR_GPIO_IN1, MOTOR_GPIO_IN2};
    // 左轮安装方向与右轮相反，交换输入使正速度均表示车体前进。
    Motor left_motor_{MOTOR_GPIO_IN4, MOTOR_GPIO_IN3};
    Chassis chassis_{left_motor_, right_motor_};
    esp_timer_handle_t chassis_timer_ = nullptr;
    std::mutex chassis_mutex_;
    int64_t chassis_deadline_ = 0;
    Launcher launcher_{LAUNCHER_GPIO_FIRE};
    HcSr04 ultrasonic_{ULTRASONIC_GPIO_TRIG, ULTRASONIC_GPIO_ECHO};
    TaskHandle_t distance_task_ = nullptr;
    uint32_t chassis_generation_ = 0;
    bool distance_active_ = false;
    float start_distance_cm_ = 0;
    float moved_cm_ = 0;
    int requested_cm_ = 0;
    const char* motion_status_ = "idle";
    esp_timer_handle_t standby_timer_ = nullptr;
    std::atomic<int64_t> standby_started_{0};
    std::atomic<bool> standby_reply_heard_{false};
    httpd_handle_t control_server_ = nullptr;
    i2c_master_bus_handle_t display_i2c_bus_ = nullptr;
    esp_lcd_panel_io_handle_t display_panel_io_ = nullptr;
    esp_lcd_panel_handle_t display_panel_ = nullptr;
    Display* display_ = nullptr;

    // 调用方持有 chassis_mutex_，使旧测距结果和旧定时回调不能恢复已取消的运动。
    void StopChassisLocked(const char* status) {
        chassis_.drive(0, 0);
        chassis_deadline_ = 0;
        distance_active_ = false;
        ++chassis_generation_;
        motion_status_ = status;
        const auto error = esp_timer_stop(chassis_timer_);
        if (error != ESP_ERR_INVALID_STATE) {
            ESP_ERROR_CHECK(error);
        }
    }

    uint32_t DriveChassis(int forward, int turn, int duration_ms) {
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        StopChassisLocked(distance_active_ ? "cancelled" : "idle");
        if (forward != 0 || turn != 0) {
            const int64_t duration_us = static_cast<int64_t>(duration_ms) * 1000;
            chassis_deadline_ = esp_timer_get_time() + duration_us;
            ESP_ERROR_CHECK(esp_timer_start_once(chassis_timer_, duration_us));
            chassis_.drive(forward / 100.0f, turn / 100.0f);
        }
        ESP_LOGI(TAG, "Chassis drive: forward=%d turn=%d duration_ms=%d", forward, turn, duration_ms);
        return chassis_generation_;
    }

    void DriveWheels(int left, int right, int duration_ms) {
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        StopChassisLocked(distance_active_ ? "cancelled" : "idle");
        if (left != 0 || right != 0) {
            const int64_t duration_us = static_cast<int64_t>(duration_ms) * 1000;
            chassis_deadline_ = esp_timer_get_time() + duration_us;
            ESP_ERROR_CHECK(esp_timer_start_once(chassis_timer_, duration_us));
            chassis_.driveWheels(left / 100.0f, right / 100.0f);
        }
        ESP_LOGI(TAG, "Wheel drive: left=%d right=%d duration_ms=%d", left, right, duration_ms);
    }

    void SaveWheelCalibration() {
        const auto [left, right] = chassis_.wheelCalibration();
        Settings settings("chassis", true);
        settings.SetInt("left_gain", left);
        settings.SetInt("right_gain", right);
        ESP_LOGI(TAG, "Wheel calibration saved: left=%d right=%d permille", left, right);
    }

    ToolResult MoveForward(int distance_cm, int speed) {
        const auto generation = DriveChassis(0, 0, 0);
        float initial_cm = 0;
        const auto error = ultrasonic_.readDistanceCm(initial_cm);
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        if (generation != chassis_generation_) {
            return std::unexpected("运动已被新的底盘指令取消");
        }
        if (error != ESP_OK) {
            motion_status_ = "sensor_error";
            return std::unexpected(std::string("起始测距失败，未启动电机：") + esp_err_to_name(error));
        }
        if (initial_cm - distance_cm < 10.0f) {
            motion_status_ = "obstacle";
            return std::unexpected("前方空间不足：目标位置须保留至少 10cm 距离，未启动电机");
        }
        start_distance_cm_ = initial_cm;
        requested_cm_ = distance_cm;
        moved_cm_ = 0;
        distance_active_ = true;
        motion_status_ = "moving";
        chassis_deadline_ = esp_timer_get_time() + 15000000;
        ESP_ERROR_CHECK(esp_timer_start_once(chassis_timer_, 15000000));
        chassis_.drive(speed / 100.0f, 0);
        xTaskNotifyGive(distance_task_);
        ESP_LOGI(TAG, "Distance move started: requested=%dcm initial=%.1fcm speed=%d", distance_cm, initial_cm, speed);
        return std::string("已开始按超声波距离反馈前进，尚未完成；可调用 self.ultrasonic.get_distance 查询进度和停止原因");
    }

    void RunDistanceControl() {
        while (true) {
            ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
            while (true) {
                uint32_t generation;
                {
                    std::lock_guard<std::mutex> lock(chassis_mutex_);
                    if (!distance_active_) {
                        break;
                    }
                    generation = chassis_generation_;
                }
                float current_cm = 0;
                // 驱动负责 >=60ms 采样间隔；等待回波时不能持有底盘锁，急停仍可立即执行。
                const auto error = ultrasonic_.readDistanceCm(current_cm);
                {
                    std::lock_guard<std::mutex> lock(chassis_mutex_);
                    if (generation != chassis_generation_ || !distance_active_) {
                        continue;
                    }
                    if (error != ESP_OK) {
                        StopChassisLocked("sensor_error");
                        ESP_LOGW(TAG, "Distance move stopped: %s", esp_err_to_name(error));
                        continue;
                    }
                    moved_cm_ = start_distance_cm_ - current_cm;
                    if (current_cm <= 10.0f || moved_cm_ >= requested_cm_) {
                        StopChassisLocked(moved_cm_ >= requested_cm_ ? "reached" : "obstacle");
                        ESP_LOGI(TAG, "Distance move stopped: %s moved=%.1fcm requested=%dcm", motion_status_, moved_cm_, requested_cm_);
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
                board->StopChassisLocked(board->distance_active_ ? "timeout" : "idle");
                ESP_LOGI(TAG, "Chassis stopped: duration elapsed");
            }
        };
        ESP_ERROR_CHECK(esp_timer_create(&timer, &chassis_timer_));
        Settings settings("chassis");
        if (!chassis_.setWheelCalibration(settings.GetInt("left_gain", 1000), settings.GetInt("right_gain", 1000))) {
            ESP_LOGW(TAG, "Invalid wheel calibration; using defaults");
        }
        if (xTaskCreate([](void* arg) {
                static_cast<PaoBoard*>(arg)->RunDistanceControl();
            }, "distance_move", 4096, this, 5, &distance_task_) != pdPASS) {
            ESP_ERROR_CHECK(ESP_ERR_NO_MEM);
        }

        auto& mcp = McpServer::GetInstance();
        mcp.AddTool("self.chassis.drive",
            "是什么：小车的两轮底盘，左右各一个直流电机。\n"
            "能做什么：让小车前进、后退、边走边转弯或原地旋转，行驶指定时长后自动停下。"
            "用户说走、开、前进、后退、倒车、左转、右转、掉头、转圈时调用。"
            "新指令会立即替换正在执行的运动。\n"
            "参数：\n"
            "- forward（必填，整数 -100 到 100）：前后速度百分比，正数前进，负数后退，0 不前后移动。\n"
            "- turn（必填，整数 -100 到 100）：转向百分比，正数左转，负数右转，0 不转向；"
            "forward 为 0、turn 不为 0 时原地旋转。forward 和 turn 都为 0 时立即停止。\n"
            "- duration_ms（可选，整数 100 到 15000，默认 1000）：行驶毫秒数，到时自动停止；"
            "超过 15000 会报错且不执行，需要更久请分多次调用。\n"
            "速度是电机占空比，不代表实际距离或转过的角度。\n"
            "按厘米前进请使用 self.chassis.move_forward。\n"
            "返回：true 表示已开始执行。",
            PropertyList({Property("forward", kPropertyTypeInteger, -100, 100),
                          Property("turn", kPropertyTypeInteger, -100, 100),
                          Property("duration_ms", kPropertyTypeInteger, 1000, 100, 15000)}),
            [this](const PropertyList& properties) -> ReturnValue {
                DriveChassis(properties["forward"].value<int>(), properties["turn"].value<int>(),
                             properties["duration_ms"].value<int>());
                return true;
            });
        mcp.AddTool("self.chassis.stop",
            "是什么：小车两轮底盘的急停。\n"
            "能做什么：立刻让两个电机停转，并取消当前定时或按距离运动。"
            "用户说停、停下、别动、刹车时调用。\n"
            "参数：无。\n"
            "返回：true 表示已停止。",
            PropertyList(),
            [this](const PropertyList&) -> ReturnValue {
                DriveChassis(0, 0, 0);
                return true;
            });
        mcp.AddTool("self.chassis.move_forward",
            "是什么：通过前方超声波距离变化反馈控制小车直行。用户要求前进多少厘米时调用。\n"
            "参数：distance_cm 必填整数 1..390；speed 可选整数 1..100，默认 50，为电机占空比。\n"
            "以前方同一静止反射物的起始距离减当前距离估算前进量，到达后停车；"
            "必须有稳定反射物，不支持空旷环境里程测量、倒退或转弯。"
            "目标位置必须保留至少 10cm；空间不足或起始测距失败直接报错且不启动。"
            "新底盘指令会替换旧运动；途中无回波、测距错误、前方不足 10cm 或超过 15 秒立即停止。"
            "受采样间隔和惯性影响，不能保证厘米级精度。\n"
            "返回：已开始，尚未完成；使用 self.ultrasonic.get_distance 查询进度及停止原因。",
            PropertyList({Property("distance_cm", kPropertyTypeInteger, 1, 390),
                          Property("speed", kPropertyTypeInteger, 50, 1, 100)}),
            [this](const PropertyList& properties) -> ToolResult {
                return MoveForward(properties["distance_cm"].value<int>(), properties["speed"].value<int>());
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
        const auto error = ultrasonic_.readDistanceCm(distance_cm);
        auto* result = cJSON_CreateObject();
        if (error == ESP_OK) {
            cJSON_AddNumberToObject(result, "distance_cm", distance_cm);
            cJSON_AddNullToObject(result, "error");
        } else {
            cJSON_AddNullToObject(result, "distance_cm");
            cJSON_AddStringToObject(result, "error", esp_err_to_name(error));
        }
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        cJSON_AddStringToObject(result, "motion_status", motion_status_);
        cJSON_AddNumberToObject(result, "requested_cm", requested_cm_);
        cJSON_AddNumberToObject(result, "moved_cm", moved_cm_);
        return result;
    }

    // 语音工具和网页遥控在不同任务里调用，Launcher 自身串行化继电器脉冲。
    void FireLauncher() {
        launcher_.fire();
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
    static bool QueryInt(httpd_req_t* req, const char* key, int fallback, int min, int max, int& out) {
        out = fallback;
        char query[128];
        char value[16];
        if (httpd_req_get_url_query_str(req, query, sizeof(query)) != ESP_OK ||
            httpd_query_key_value(query, key, value, sizeof(value)) != ESP_OK) {
            return true;
        }
        char* end = nullptr;
        const long parsed = std::strtol(value, &end, 10);
        if (end == value || *end != '\0' || parsed < min || parsed > max) {
            return false;
        }
        out = static_cast<int>(parsed);
        return true;
    }

    static esp_err_t Reply(httpd_req_t* req, const char* status, const char* type, const char* body) {
        httpd_resp_set_status(req, status);
        httpd_resp_set_type(req, type);
        httpd_resp_set_hdr(req, "Cache-Control", "no-store");
        httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "http://127.0.0.1:8080");
        return httpd_resp_sendstr(req, body);
    }

    static esp_err_t BadRequest(httpd_req_t* req, const char* message) {
        return Reply(req, "400 Bad Request", "text/plain; charset=utf-8", message);
    }

    static esp_err_t Ok(httpd_req_t* req) {
        return Reply(req, "200 OK", "text/plain", "ok");
    }

    static PaoBoard* Self(httpd_req_t* req) {
        return static_cast<PaoBoard*>(req->user_ctx);
    }

    // 局域网遥控页，参数范围与同名 MCP 工具一致；没有鉴权，只应在可信网络中使用。
    void StartControlServer() {
        if (control_server_ != nullptr) {
            return;
        }
        httpd_config_t config = HTTPD_DEFAULT_CONFIG();
        config.server_port = 80;
        config.ctrl_port = 32769;
        config.max_uri_handlers = 10;
        config.lru_purge_enable = true;
        if (httpd_start(&control_server_, &config) != ESP_OK) {
            ESP_LOGE(TAG, "Control server failed to start");
            control_server_ = nullptr;
            return;
        }
        const httpd_uri_t routes[] = {
            {"/", HTTP_GET, [](httpd_req_t* req) {
                return Reply(req, "200 OK", "text/html; charset=utf-8", kControlPage);
            }, this},
            {"/api/status", HTTP_GET, [](httpd_req_t* req) {
                const auto [left, right] = Self(req)->chassis_.wheelCalibration();
                char status[80];
                std::snprintf(status, sizeof(status), "{\"left_gain_permille\":%d,\"right_gain_permille\":%d}", left, right);
                return Reply(req, "200 OK", "application/json", status);
            }, this},
            {"/api/drive", HTTP_POST, [](httpd_req_t* req) {
                int forward, turn, duration_ms;
                if (!QueryInt(req, "forward", 0, -100, 100, forward) || !QueryInt(req, "turn", 0, -100, 100, turn) ||
                    !QueryInt(req, "duration_ms", 1000, 100, 15000, duration_ms)) {
                    return BadRequest(req, "forward/turn 取 -100..100，duration_ms 取 100..15000");
                }
                Self(req)->DriveChassis(forward, turn, duration_ms);
                return Ok(req);
            }, this},
            {"/api/stop", HTTP_POST, [](httpd_req_t* req) {
                Self(req)->DriveChassis(0, 0, 0);
                return Ok(req);
            }, this},
            {"/api/wheels", HTTP_POST, [](httpd_req_t* req) {
                int left, right, duration_ms;
                if (!QueryInt(req, "left", 0, -100, 100, left) || !QueryInt(req, "right", 0, -100, 100, right) ||
                    !QueryInt(req, "duration_ms", 1000, 100, 15000, duration_ms)) {
                    return BadRequest(req, "left/right 取 -100..100，duration_ms 取 100..15000");
                }
                Self(req)->DriveWheels(left, right, duration_ms);
                return Ok(req);
            }, this},
            {"/api/calibrate", HTTP_POST, [](httpd_req_t* req) {
                int forward, turn;
                if (!QueryInt(req, "forward", 0, 1, 100, forward) || !QueryInt(req, "turn", 0, -100, 100, turn)) {
                    return BadRequest(req, "需要向前微调的 forward/turn");
                }
                auto* board = Self(req);
                std::lock_guard<std::mutex> lock(board->chassis_mutex_);
                board->StopChassisLocked(board->distance_active_ ? "cancelled" : "idle");
                if (!board->chassis_.calibrateForward(forward / 100.0f, turn / 100.0f)) {
                    return BadRequest(req, "请先向前微调至走直；两轮都须向前，修正比例不能低于 10%");
                }
                board->SaveWheelCalibration();
                return Ok(req);
            }, this},
            {"/api/calibration/reset", HTTP_POST, [](httpd_req_t* req) {
                auto* board = Self(req);
                std::lock_guard<std::mutex> lock(board->chassis_mutex_);
                board->StopChassisLocked(board->distance_active_ ? "cancelled" : "idle");
                board->chassis_.setWheelCalibration(1000, 1000);
                board->SaveWheelCalibration();
                return Ok(req);
            }, this},
            {"/api/distance", HTTP_GET, [](httpd_req_t* req) {
                CJsonUniquePtr result(Self(req)->ReadDistance());
                CJsonStringUniquePtr text(cJSON_PrintUnformatted(result.get()));
                if (!text) {
                    return Reply(req, "500 Internal Server Error", "text/plain", "Cannot encode distance");
                }
                return Reply(req, "200 OK", "application/json", text.get());
            }, this},
            {"/api/move_forward", HTTP_POST, [](httpd_req_t* req) {
                int distance_cm, speed;
                if (!QueryInt(req, "distance_cm", 20, 1, 390, distance_cm) || !QueryInt(req, "speed", 50, 1, 100, speed)) {
                    return BadRequest(req, "distance_cm 取 1..390，speed 取 1..100");
                }
                const auto result = Self(req)->MoveForward(distance_cm, speed);
                if (!result) { return BadRequest(req, result.error().c_str()); }
                return Ok(req);
            }, this},
            {"/api/launcher/fire", HTTP_POST, [](httpd_req_t* req) {
                Self(req)->FireLauncher();
                return Ok(req);
            }, this},
        };
        for (const auto& route : routes) {
            ESP_ERROR_CHECK(httpd_register_uri_handler(control_server_, &route));
        }
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
