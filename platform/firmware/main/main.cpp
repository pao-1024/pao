#include "wiring.h"
#include "motor.h"
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstring>
#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "driver/i2s_std.h"
#include "driver/uart.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

[[maybe_unused]] static void output(gpio_num_t pin) {
    ESP_ERROR_CHECK(gpio_set_level(pin, 0));
    gpio_config_t cfg = {};
    cfg.pin_bit_mask = 1ULL << pin;
    cfg.mode = GPIO_MODE_OUTPUT;
    ESP_ERROR_CHECK(gpio_config(&cfg));
}

#if HAS_OLED
static i2c_master_dev_handle_t oled;
static bool inverted;
static void display() {
    uint8_t data[513] = {0x40};
    // A moving checkerboard proves that the guest writes all four display pages.
    for (int i = 1; i <= 512; ++i) data[i] = ((i / 8) & 1) ^ inverted ? 0x55 : 0xaa;
    ESP_ERROR_CHECK(i2c_master_transmit(oled, data, sizeof(data), 1000));
    printf("STUDIO OLED frame 128x32 SDA=%d SCL=%d RST=%d\n", OLED_SDA, OLED_SCL, OLED_RST);
}
static void init_oled() {
    output((gpio_num_t)OLED_RST);
    vTaskDelay(pdMS_TO_TICKS(10));
    ESP_ERROR_CHECK(gpio_set_level((gpio_num_t)OLED_RST, 1));
    i2c_master_bus_config_t bus_cfg = {};
    bus_cfg.i2c_port = I2C_NUM_0;
    bus_cfg.sda_io_num = (gpio_num_t)OLED_SDA;
    bus_cfg.scl_io_num = (gpio_num_t)OLED_SCL;
    bus_cfg.clk_source = I2C_CLK_SRC_DEFAULT;
    bus_cfg.glitch_ignore_cnt = 7;
    // The selected breakout already provides pull-ups to its 3.3V VIN.
    i2c_master_bus_handle_t bus;
    ESP_ERROR_CHECK(i2c_new_master_bus(&bus_cfg, &bus));
    i2c_device_config_t dev = {};
    dev.dev_addr_length = I2C_ADDR_BIT_LEN_7;
    dev.device_address = 0x3c;
    dev.scl_speed_hz = 100000;
    ESP_ERROR_CHECK(i2c_master_bus_add_device(bus, &dev, &oled));
    uint8_t init[] = {0, 0xae, 0xd5, 0x80, 0xa8, 31, 0xd3, 0, 0x40, 0x8d, 0x14,
                      0x20, 0, 0xa1, 0xc8, 0xda, 2, 0x81, 0x8f, 0xd9, 0xf1, 0xdb, 0x40,
                      0xa4, 0xa6, 0xaf, 0x21, 0, 127, 0x22, 0, 3};
    ESP_ERROR_CHECK(i2c_master_transmit(oled, init, sizeof(init), 1000));
    display();
}
#endif

#if HAS_MIC || HAS_AMP
[[maybe_unused]] static i2s_chan_handle_t rx, tx;
static std::atomic<bool> play_tone{false};
static i2s_std_config_t audio_config(int bclk, int ws, int din, int dout) {
    i2s_std_config_t cfg = {};
    cfg.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(48000);
    cfg.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO);
    cfg.gpio_cfg.mclk = I2S_GPIO_UNUSED;
    cfg.gpio_cfg.bclk = (gpio_num_t)bclk;
    cfg.gpio_cfg.ws = (gpio_num_t)ws;
    cfg.gpio_cfg.din = (gpio_num_t)din;
    cfg.gpio_cfg.dout = (gpio_num_t)dout;
    return cfg;
}
static void audio(void *) {
    [[maybe_unused]] static int32_t input[480 * 2] = {}, samples[480 * 2] = {};
    [[maybe_unused]] uint32_t frame = 0;
    uint32_t packets = 0;
    int peak = 0;
    while (true) {
        size_t bytes;
#if HAS_MIC
        ESP_ERROR_CHECK(i2s_channel_read(rx, input, sizeof(input), &bytes, 1000));
        if (bytes != sizeof(input)) abort();
        for (unsigned i = MIC_CHANNEL; i < bytes / sizeof(int32_t); i += 2)
            peak = std::max(peak, std::abs((int)(input[i] / 65536)));
#endif
#if HAS_AMP
        for (int i = 0; i < 480; ++i, ++frame) {
            int32_t value = play_tone ? (int32_t)(std::sin(frame * 6.283185307 * 440 / 48000) * 2000) * 65536 : 0;
            samples[i * 2] = samples[i * 2 + 1] = value;
        }
        ESP_ERROR_CHECK(i2s_channel_write(tx, samples, sizeof(samples), &bytes, 1000));
        if (bytes != sizeof(samples)) abort();
#endif
        if (++packets % 100 == 0) {
            printf("STUDIO AUDIO rate=48000 slots=32x2 rx_peak=%d tx=%s\n", peak, play_tone ? "tone440" : "silence");
            peak = 0;
        }
    }
}
static void init_audio() {
#if HAS_AMP
    i2s_chan_config_t out = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    ESP_ERROR_CHECK(i2s_new_channel(&out, &tx, nullptr));
    auto tx_cfg = audio_config(AMP_BCLK, AMP_WS, -1, AMP_DATA);
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(tx, &tx_cfg));
#endif
#if HAS_MIC
    i2s_chan_config_t in = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
    ESP_ERROR_CHECK(i2s_new_channel(&in, nullptr, &rx));
    auto rx_cfg = audio_config(MIC_BCLK, MIC_WS, MIC_DATA, -1);
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx, &rx_cfg));
#endif
#if HAS_AMP
    ESP_ERROR_CHECK(i2s_channel_enable(tx));
#endif
#if HAS_MIC
    ESP_ERROR_CHECK(i2s_channel_enable(rx));
#endif
    if (xTaskCreate(audio, "audio", 6144, nullptr, 5, nullptr) != pdPASS) abort();
}
#endif

extern "C" void app_main() {
    setvbuf(stdout, nullptr, _IONBF, 0);
    printf("STUDIO BOOT oled=%d mic=%d amp=%d motor=%d\n", HAS_OLED, HAS_MIC, HAS_AMP, HAS_MOTOR);
#if HAS_MOTOR
    output((gpio_num_t)MOTOR_ENABLE);
    Motor a((gpio_num_t)MOTOR_A1, (gpio_num_t)MOTOR_A2);
    Motor b((gpio_num_t)MOTOR_B1, (gpio_num_t)MOTOR_B2);
    ESP_ERROR_CHECK(gpio_set_level((gpio_num_t)MOTOR_ENABLE, 1));
    int64_t motor_deadline = 0;
#endif
#if HAS_OLED
    init_oled();
#endif
#if HAS_MIC || HAS_AMP
    init_audio();
#endif
    ESP_ERROR_CHECK(uart_driver_install(UART_NUM_0, 1024, 0, 0, nullptr, 0));
    printf("STUDIO READY commands: status, display, tone, mute, motor A B (-50..50), stop\n");
    char line[80]; size_t length = 0;
    bool overflow = false;
    while (true) {
#if HAS_MOTOR
        if (motor_deadline && esp_timer_get_time() >= motor_deadline) {
            a.setSpeed(0); b.setSpeed(0); motor_deadline = 0;
            printf("STUDIO MOTOR timeout stopped\n");
        }
#endif
        uint8_t ch;
        if (uart_read_bytes(UART_NUM_0, &ch, 1, pdMS_TO_TICKS(20)) != 1) continue;
        if (ch == '\r') continue;
        if (ch != '\n') {
            if (length + 1 < sizeof(line)) line[length++] = (char)ch; else overflow = true;
            continue;
        }
        line[length] = 0; length = 0;
        if (overflow) { overflow = false; printf("STUDIO ERROR command too long\n"); continue; }
#if HAS_MOTOR
        int av, bv; char extra;
#endif
        if (!std::strcmp(line, "status")) printf("STUDIO READY oled=%d mic=%d amp=%d motor=%d\n", HAS_OLED, HAS_MIC, HAS_AMP, HAS_MOTOR);
#if HAS_OLED
        else if (!std::strcmp(line, "display")) { inverted = !inverted; display(); }
#endif
#if HAS_AMP
        else if (!std::strcmp(line, "tone")) { play_tone = true; printf("STUDIO TONE 440Hz\n"); }
        else if (!std::strcmp(line, "mute")) { play_tone = false; printf("STUDIO MUTE\n"); }
#endif
#if HAS_MOTOR
        else if (!std::strcmp(line, "stop")) { a.setSpeed(0); b.setSpeed(0); motor_deadline = 0; printf("STUDIO MOTOR 0 0\n"); }
        else if (std::sscanf(line, "motor %3d %3d %c", &av, &bv, &extra) == 2 && av >= -50 && av <= 50 && bv >= -50 && bv <= 50) {
            a.setSpeed(av / 100.0f); b.setSpeed(bv / 100.0f);
            motor_deadline = esp_timer_get_time() + 1000000;
            printf("STUDIO MOTOR %d %d timeout=1000ms\n", av, bv);
        }
#endif
        else printf("STUDIO ERROR unsupported or invalid command\n");
    }
}
