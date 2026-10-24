#include "wifi_board.h"
#include "application.h"
#include "button.h"
#include "chassis.h"
#include "codecs/no_audio_codec.h"
#include "config.h"
#include "control_page.h"
#include "display/oled_display.h"
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
#include <algorithm>
#include <atomic>
#include <esp_timer.h>
#include <cstdio>
#include <cstdlib>
#include <mutex>
#include <wifi_manager.h>

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
    Launcher launcher_{LAUNCHER_GPIO_CHARGE, LAUNCHER_GPIO_FIRE};
    esp_timer_handle_t launcher_timer_ = nullptr;
    std::mutex launcher_mutex_;
    int64_t launcher_deadline_ = 0;
    bool launcher_fire_after_charge_ = false;
    std::mutex launcher_fire_mutex_;
    esp_timer_handle_t standby_timer_ = nullptr;
    std::atomic<int64_t> standby_started_{0};
    std::atomic<bool> standby_reply_heard_{false};
    httpd_handle_t control_server_ = nullptr;
    i2c_master_bus_handle_t display_i2c_bus_ = nullptr;
    esp_lcd_panel_io_handle_t display_panel_io_ = nullptr;
    esp_lcd_panel_handle_t display_panel_ = nullptr;
    Display* display_ = nullptr;

    void DriveChassis(int forward, int turn, int duration_ms) {
        std::lock_guard<std::mutex> lock(chassis_mutex_);
        chassis_.drive(0, 0);
        chassis_deadline_ = 0;
        const auto error = esp_timer_stop(chassis_timer_);
        if (error != ESP_ERR_INVALID_STATE) {
            ESP_ERROR_CHECK(error);
        }
        if (forward != 0 || turn != 0) {
            const int64_t duration_us = static_cast<int64_t>(duration_ms) * 1000;
            chassis_deadline_ = esp_timer_get_time() + duration_us;
            ESP_ERROR_CHECK(esp_timer_start_once(chassis_timer_, duration_us));
            chassis_.drive(forward / 100.0f, turn / 100.0f);
        }
        ESP_LOGI(TAG, "Chassis drive: forward=%d turn=%d duration_ms=%d", forward, turn, duration_ms);
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
                board->chassis_.drive(0, 0);
                board->chassis_deadline_ = 0;
                ESP_LOGI(TAG, "Chassis stopped: duration elapsed");
            }
        };
        ESP_ERROR_CHECK(esp_timer_create(&timer, &chassis_timer_));

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
            "能做什么：立刻让两个电机停转，并取消 self.chassis.drive 还没走完的定时运动。"
            "用户说停、停下、别动、刹车时调用。\n"
            "参数：无。\n"
            "返回：true 表示已停止。",
            PropertyList(),
            [this](const PropertyList&) -> ReturnValue {
                DriveChassis(0, 0, 0);
                return true;
            });
    }

    // duration_ms 为 0 时断开供电，否则供电并在到时后自动断开；fire_after 为真时断电后发射一次。
    void ChargeLauncher(int duration_ms, bool fire_after = false) {
        std::lock_guard<std::mutex> lock(launcher_mutex_);
        launcher_deadline_ = 0;
        launcher_fire_after_charge_ = duration_ms > 0 && fire_after;
        const auto error = esp_timer_stop(launcher_timer_);
        if (error != ESP_ERR_INVALID_STATE) {
            ESP_ERROR_CHECK(error);
        }
        if (duration_ms > 0) {
            const int64_t duration_us = static_cast<int64_t>(duration_ms) * 1000;
            launcher_deadline_ = esp_timer_get_time() + duration_us;
            ESP_ERROR_CHECK(esp_timer_start_once(launcher_timer_, duration_us));
        }
        launcher_.setCharging(duration_ms > 0);
        ESP_LOGI(TAG, "Launcher charge: duration_ms=%d fire_after=%d", duration_ms,
                 launcher_fire_after_charge_);
    }

    ToolResult FireLauncher() {
        // 语音工具和网页遥控在不同任务里调用，串行化继电器脉冲。
        std::lock_guard<std::mutex> lock(launcher_fire_mutex_);
        if (launcher_.fire() != ESP_OK) {
            ESP_LOGW(TAG, "Launcher fire rejected: charging");
            return std::unexpected(std::string("Launcher is charging; wait or call self.launcher.stop first"));
        }
        ESP_LOGI(TAG, "Launcher fired");
        return true;
    }

    void InitializeLauncherTools() {
        esp_timer_create_args_t timer = {};
        timer.arg = this;
        timer.name = "launcher_charge";
        timer.callback = [](void* arg) {
            auto* board = static_cast<PaoBoard*>(arg);
            std::lock_guard<std::mutex> lock(board->launcher_mutex_);
            // 已排队的旧定时回调不能截断刚收到的新充能指令。
            if (board->launcher_deadline_ != 0 && esp_timer_get_time() >= board->launcher_deadline_) {
                board->launcher_.setCharging(false);
                board->launcher_deadline_ = 0;
                ESP_LOGI(TAG, "Launcher charge stopped: duration elapsed");
                if (board->launcher_fire_after_charge_) {
                    board->launcher_fire_after_charge_ = false;
                    // fire() 阻塞约 100 ms，交给主任务执行，不占用 esp_timer 任务。
                    Application::GetInstance().Schedule([board]() { board->FireLauncher(); });
                }
            }
        };
        ESP_ERROR_CHECK(esp_timer_create(&timer, &launcher_timer_));

        auto& mcp = McpServer::GetInstance();
        mcp.AddTool("self.launcher.charge",
            "是什么：小车上的电磁炮（电磁发射器），由继电器控制供电（充能）和发射按钮。\n"
            "能做什么：只给电磁炮预先充能，不发射；供电指定时长后自动断电，电量保留到下次发射。"
            "仅当用户明确说先充能、蓄力、准备但还不发射时调用；用户要开炮请直接调用 self.launcher.fire，"
            "不要先调用本工具。重复调用会重新计时，并取消尚未执行的自动发射。\n"
            "参数：\n"
            "- duration_ms（可选，整数 1000 到 30000，默认 5000）：充能毫秒数。\n"
            "返回：true 表示已开始充能（调用立即返回，不等充能结束）。",
            PropertyList({Property("duration_ms", kPropertyTypeInteger, 5000, 1000, 30000)}),
            [this](const PropertyList& properties) -> ReturnValue {
                ChargeLauncher(properties["duration_ms"].value<int>());
                return true;
            });
        mcp.AddTool("self.launcher.fire",
            "是什么：小车上的电磁炮（电磁发射器），由继电器控制供电（充能）和发射按钮。\n"
            "能做什么：开炮，发射一次。用户说开炮、开火、发射、射击、打一发、biu 一下时调用，"
            "一次调用即可完成充能和发射，不需要先调用其他工具。要连续开多炮就调用多次，"
            "每次等上一炮完成后再调用。\n"
            "参数：\n"
            "- charge_ms（可选，整数 0 到 30000，默认 5000）：发射前的充能毫秒数。"
            "大于 0 时先充能，到时自动断电再发射，所以炮弹在约 charge_ms 毫秒后才射出；"
            "用户要求威力大一点可以加长，要求立刻发射且之前已用 self.launcher.charge 充好能时传 0。"
            "传 0 时如果电磁炮正在充能会返回错误，不发射。\n"
            "返回：true 表示已接受指令（charge_ms 大于 0 时调用立即返回，充能结束后自动发射）。",
            PropertyList({Property("charge_ms", kPropertyTypeInteger, 5000, 0, 30000)}),
            [this](const PropertyList& properties) -> ToolResult {
                const int charge_ms = properties["charge_ms"].value<int>();
                if (charge_ms > 0) {
                    ChargeLauncher(charge_ms, true);
                    return true;
                }
                return FireLauncher();
            });
        mcp.AddTool("self.launcher.stop",
            "是什么：小车电磁炮（电磁发射器）的安全停止。\n"
            "能做什么：立刻断开电磁炮供电，取消正在进行的充能和还没执行的自动发射。"
            "用户说别打了、取消开炮、停止充能、关掉电磁炮时调用。\n"
            "参数：无。\n"
            "返回：true 表示已断电。",
            PropertyList(),
            [this](const PropertyList&) -> ReturnValue {
                ChargeLauncher(0);
                return true;
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
        config.max_uri_handlers = 8;
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
                auto* board = Self(req);
                int64_t remaining_ms = 0;
                {
                    std::lock_guard<std::mutex> lock(board->launcher_mutex_);
                    if (board->launcher_deadline_ != 0) {
                        remaining_ms = std::max<int64_t>(0, (board->launcher_deadline_ - esp_timer_get_time()) / 1000);
                    }
                }
                char body[96];
                std::snprintf(body, sizeof(body), "{\"charging\":%s,\"charge_remaining_ms\":%lld}",
                              board->launcher_.isCharging() ? "true" : "false", static_cast<long long>(remaining_ms));
                return Reply(req, "200 OK", "application/json", body);
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
            {"/api/launcher/charge", HTTP_POST, [](httpd_req_t* req) {
                int duration_ms;
                if (!QueryInt(req, "duration_ms", 5000, 1000, 30000, duration_ms)) {
                    return BadRequest(req, "duration_ms 取 1000..30000");
                }
                Self(req)->ChargeLauncher(duration_ms);
                return Ok(req);
            }, this},
            {"/api/launcher/fire", HTTP_POST, [](httpd_req_t* req) {
                int charge_ms;
                if (!QueryInt(req, "charge_ms", 5000, 0, 30000, charge_ms)) {
                    return BadRequest(req, "charge_ms 取 0..30000");
                }
                if (charge_ms > 0) {
                    Self(req)->ChargeLauncher(charge_ms, true);
                    return Ok(req);
                }
                return Self(req)->FireLauncher() ? Ok(req)
                    : Reply(req, "409 Conflict", "text/plain; charset=utf-8", "正在充能，等充能结束或先断电");
            }, this},
            {"/api/launcher/stop", HTTP_POST, [](httpd_req_t* req) {
                Self(req)->ChargeLauncher(0);
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
