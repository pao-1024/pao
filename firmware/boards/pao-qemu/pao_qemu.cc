#include "board.h"
#include "application.h"
#include "button.h"
#include "codecs/no_audio_codec.h"
#include "../pao/config.h"
#include "chassis.h"
#include "motor.h"
#include "display/oled_display.h"
#include "led/single_led.h"
#include "system_info.h"
#include <driver/i2c_master.h>
#include <esp_eth.h>
#include <esp_eth_mac_openeth.h>
#include <esp_event.h>
#include <esp_lcd_panel_vendor.h>
#include <esp_netif.h>
#include <esp_log.h>
#include <esp_network.h>
#include <material_symbols.h>

class PaoQemuBoard : public Board {
    Button boot_button_{BOOT_BUTTON_GPIO};
    Motor right_motor_{MOTOR_GPIO_IN1, MOTOR_GPIO_IN2};
    Motor left_motor_{MOTOR_GPIO_IN3, MOTOR_GPIO_IN4};
    Chassis chassis_{left_motor_, right_motor_};
    OledDisplay* display_ = nullptr;
    NetworkEventCallback callback_;
    bool connected_ = false;

    static void NetworkEventHandler(void* arg, esp_event_base_t base,
                                    int32_t event, void* data) {
        auto* board = static_cast<PaoQemuBoard*>(arg);
        if (base == IP_EVENT && event == IP_EVENT_ETH_GOT_IP) {
            board->connected_ = true;
            if (board->callback_) board->callback_(NetworkEvent::Connected, "OpenETH");
        } else if (base == ETH_EVENT && event == ETHERNET_EVENT_DISCONNECTED) {
            board->connected_ = false;
            if (board->callback_) board->callback_(NetworkEvent::Disconnected, "OpenETH");
        }
    }

public:
    PaoQemuBoard() {
        boot_button_.OnPressDown([]() { ESP_LOGI("PaoQemu", "BOOT_DOWN"); });
        boot_button_.OnPressUp([]() { ESP_LOGI("PaoQemu", "BOOT_UP"); });
        boot_button_.OnClick([]() { Application::GetInstance().ToggleChatState(); });
        i2c_master_bus_handle_t bus;
        i2c_master_bus_config_t config = {};
        config.i2c_port = 0;
        config.sda_io_num = GPIO_NUM_41;
        config.scl_io_num = GPIO_NUM_42;
        config.clk_source = I2C_CLK_SRC_DEFAULT;
        config.glitch_ignore_cnt = 7;
        config.flags.enable_internal_pullup = true;
        ESP_ERROR_CHECK(i2c_new_master_bus(&config, &bus));
        esp_lcd_panel_io_handle_t io;
        esp_lcd_panel_io_i2c_config_t io_config = {};
        io_config.dev_addr = 0x3c;
        io_config.scl_speed_hz = 400000;
        io_config.control_phase_bytes = 1;
        io_config.lcd_cmd_bits = io_config.lcd_param_bits = 8;
        io_config.dc_bit_offset = 6;
        ESP_ERROR_CHECK(esp_lcd_new_panel_io_i2c(bus, &io_config, &io));
        esp_lcd_panel_handle_t panel;
        esp_lcd_panel_ssd1306_config_t vendor = {.height = 64};
        esp_lcd_panel_dev_config_t panel_config = {};
        panel_config.reset_gpio_num = GPIO_NUM_NC;
        panel_config.bits_per_pixel = 1;
        panel_config.vendor_config = &vendor;
        ESP_ERROR_CHECK(esp_lcd_new_panel_ssd1306(io, &panel_config, &panel));
        ESP_ERROR_CHECK(esp_lcd_panel_reset(panel));
        ESP_ERROR_CHECK(esp_lcd_panel_init(panel));
        ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel, true));
        display_ = new OledDisplay(io, panel, 128, 64, false, false);
    }
    std::string GetBoardType() override { return "ethernet"; }
    Display* GetDisplay() override { return display_; }
    AudioCodec* GetAudioCodec() override {
        static NoAudioCodecSimplex codec(AUDIO_INPUT_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE,
            AUDIO_I2S_SPK_GPIO_BCLK, AUDIO_I2S_SPK_GPIO_LRCK, AUDIO_I2S_SPK_GPIO_DOUT,
            AUDIO_I2S_MIC_GPIO_SCK, AUDIO_I2S_MIC_GPIO_WS, AUDIO_I2S_MIC_GPIO_DIN);
        return &codec;
    }
    Led* GetLed() override { static SingleLed led(BUILTIN_LED_GPIO); return &led; }
    NetworkInterface* GetNetwork() override { static EspNetwork network; return &network; }
    void SetNetworkEventCallback(NetworkEventCallback callback) override { callback_ = std::move(callback); }
    const char* GetNetworkStateIcon() override { return MATERIAL_SYMBOLS_WIFI; }
    void SetPowerSaveLevel(PowerSaveLevel) override {}
    std::string GetDeviceStatusJson() override { return connected_ ? "{\"network\":\"connected\"}" : "{\"network\":\"disconnected\"}"; }
    std::string GetBoardJson() override {
        return "{\"type\":\"pao\",\"name\":\"pao-qemu\",\"mac\":\"" + SystemInfo::GetMacAddress() + "\"}";
    }
    void StartNetwork() override {
        ESP_ERROR_CHECK(esp_netif_init());
        ESP_ERROR_CHECK(esp_event_loop_create_default());
        esp_netif_config_t netif_config = ESP_NETIF_DEFAULT_ETH();
        esp_netif_t* netif = esp_netif_new(&netif_config);
        assert(netif);
        eth_mac_config_t mac_config = ETH_MAC_DEFAULT_CONFIG();
        eth_phy_config_t phy_config = ETH_PHY_DEFAULT_CONFIG();
        phy_config.phy_addr = 1;
        phy_config.reset_gpio_num = -1;
        esp_eth_mac_t* mac = esp_eth_mac_new_openeth(&mac_config);
        esp_eth_phy_t* phy = esp_eth_phy_new_generic(&phy_config);
        assert(mac && phy);
        esp_eth_config_t eth_config = ETH_DEFAULT_CONFIG(mac, phy);
        esp_eth_handle_t handle;
        ESP_ERROR_CHECK(esp_eth_driver_install(&eth_config, &handle));
        ESP_ERROR_CHECK(esp_netif_attach(netif, esp_eth_new_netif_glue(handle)));
        ESP_ERROR_CHECK(esp_event_handler_register(ETH_EVENT, ESP_EVENT_ANY_ID, NetworkEventHandler, this));
        ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, NetworkEventHandler, this));
        if (callback_) callback_(NetworkEvent::Connecting, "OpenETH");
        ESP_ERROR_CHECK(esp_eth_start(handle));
    }
};
DECLARE_BOARD(PaoQemuBoard);
