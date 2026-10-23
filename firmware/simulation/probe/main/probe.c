#include <assert.h>
#include <string.h>
#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "driver/i2s_std.h"
#include "driver/rmt_tx.h"
#include "driver/rmt_encoder.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_vendor.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs.h"
#include "nvs_flash.h"

static void oled(void) {
    i2c_master_bus_handle_t bus;
    i2c_master_bus_config_t config = {.i2c_port = 0, .sda_io_num = 41, .scl_io_num = 42,
        .clk_source = I2C_CLK_SRC_DEFAULT, .glitch_ignore_cnt = 7, .flags.enable_internal_pullup = true};
    ESP_ERROR_CHECK(i2c_new_master_bus(&config, &bus));
    assert(i2c_master_probe(bus, 0x3d, 200) == ESP_ERR_NOT_FOUND);
    esp_err_t result = i2c_master_probe(bus, 0x3c, 200);
    ESP_ERROR_CHECK(result);
    esp_lcd_panel_io_handle_t io;
    esp_lcd_panel_io_i2c_config_t io_config = {.dev_addr = 0x3c, .scl_speed_hz = 400000,
        .control_phase_bytes = 1, .lcd_cmd_bits = 8, .lcd_param_bits = 8, .dc_bit_offset = 6};
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_i2c(bus, &io_config, &io));
    esp_lcd_panel_handle_t panel;
    esp_lcd_panel_ssd1306_config_t vendor = {.height = 64};
    esp_lcd_panel_dev_config_t panel_config = {.bits_per_pixel = 1, .reset_gpio_num = -1, .vendor_config = &vendor};
    ESP_ERROR_CHECK(esp_lcd_new_panel_ssd1306(io, &panel_config, &panel));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel, true));
    uint8_t pixels[1024];
    memset(pixels, 0xaa, sizeof(pixels));
    ESP_ERROR_CHECK(esp_lcd_panel_draw_bitmap(panel, 0, 0, 128, 64, pixels));
    ESP_LOGI("PROBE", "OLED_FRAME_READY");
}

static void audio(void) {
    i2s_chan_handle_t tx, rx;
    i2s_chan_config_t chan = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    ESP_ERROR_CHECK(i2s_new_channel(&chan, &tx, NULL));
    chan.id = I2S_NUM_1;
    ESP_ERROR_CHECK(i2s_new_channel(&chan, NULL, &rx));
    i2s_std_config_t config = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(24000),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {.mclk = I2S_GPIO_UNUSED, .bclk = 15, .ws = 16, .dout = 7, .din = I2S_GPIO_UNUSED}};
    config.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(tx, &config));
    config.clk_cfg.sample_rate_hz = 16000;
    config.gpio_cfg.bclk = 5;
    config.gpio_cfg.ws = 4;
    config.gpio_cfg.dout = I2S_GPIO_UNUSED;
    config.gpio_cfg.din = 6;
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx, &config));
    ESP_LOGI("PROBE", "I2S BEFORE_TX_ENABLE");
    ESP_ERROR_CHECK(i2s_channel_enable(tx));
    ESP_LOGI("PROBE", "I2S AFTER_TX_ENABLE");
    ESP_ERROR_CHECK(i2s_channel_enable(rx));
    static int32_t samples[8192];
    for (int i = 0; i < 8192; i++) samples[i] = 0x23450000;
    size_t count = 0;
    esp_err_t result = i2s_channel_write(tx, samples, sizeof(samples), &count, 200);
    ESP_LOGI("PROBE", "I2S TX sustained transfer: %s bytes=%u", esp_err_to_name(result), (unsigned)count);
    assert(result == ESP_OK && count == sizeof(samples));
    count = 0;
    result = i2s_channel_read(rx, samples, 1024, &count, 200);
    ESP_LOGI("PROBE", "I2S RX transfer: %s bytes=%u", esp_err_to_name(result), (unsigned)count);
    assert(result == ESP_OK && count == 1024);
    for (int i = 0; i < count / sizeof(samples[0]); i++) assert(samples[i] == 0x01234000);
    ESP_LOGI("PROBE", "AUDIO_CONTENT_PASS");
}

static void led(void) {
    rmt_channel_handle_t channel;
    rmt_tx_channel_config_t config = {.gpio_num = 48, .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10000000, .mem_block_symbols = 64, .trans_queue_depth = 1};
    ESP_ERROR_CHECK(rmt_new_tx_channel(&config, &channel));
    rmt_encoder_handle_t encoder;
    rmt_copy_encoder_config_t enc_config = {};
    ESP_ERROR_CHECK(rmt_new_copy_encoder(&enc_config, &encoder));
    ESP_ERROR_CHECK(rmt_enable(channel));
    rmt_symbol_word_t symbols[25];
    const uint32_t grb = 0x341256;
    for (int i = 0; i < 24; i++) {
        bool one = (grb >> (23-i)) & 1;
        symbols[i] = (rmt_symbol_word_t){.level0 = 1, .duration0 = one ? 8 : 4, .level1 = 0, .duration1 = one ? 4 : 8};
    }
    symbols[24] = (rmt_symbol_word_t){.level0 = 0, .duration0 = 500, .level1 = 0, .duration1 = 500};
    rmt_transmit_config_t tx_config = {};
    ESP_ERROR_CHECK(rmt_transmit(channel, encoder, symbols, sizeof(symbols), &tx_config));
    esp_err_t result = rmt_tx_wait_all_done(channel, 500);
    ESP_ERROR_CHECK(result);
    ESP_LOGI("PROBE", "LED_READY rgb=123456");
}

static void button(void) {
    gpio_config_t config = {.pin_bit_mask = 1, .mode = GPIO_MODE_INPUT, .pull_up_en = true};
    ESP_ERROR_CHECK(gpio_config(&config));
    assert(gpio_get_level(0) == 1);
    ESP_LOGI("PROBE", "BUTTON_READY");
    unsigned ticks = 0;
    while (gpio_get_level(0) && ticks++ < 5000) vTaskDelay(1);
    assert(!gpio_get_level(0));
    ESP_LOGI("PROBE", "BUTTON_PRESSED");
    ticks = 0;
    while (!gpio_get_level(0) && ticks++ < 5000) vTaskDelay(1);
    assert(gpio_get_level(0));
    ESP_LOGI("PROBE", "BUTTON_RELEASED");
}

static void storage(void) {
    ESP_ERROR_CHECK(nvs_flash_init());
    nvs_handle_t handle;
    ESP_ERROR_CHECK(nvs_open("probe", NVS_READWRITE, &handle));
    ESP_ERROR_CHECK(nvs_set_str(handle, "roundtrip", "QEMU flash roundtrip"));
    ESP_ERROR_CHECK(nvs_commit(handle));
    nvs_close(handle);
    ESP_ERROR_CHECK(nvs_flash_deinit());
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(nvs_open("probe", NVS_READONLY, &handle));
    char value[32];
    size_t size = sizeof(value);
    ESP_ERROR_CHECK(nvs_get_str(handle, "roundtrip", value, &size));
    assert(strcmp(value, "QEMU flash roundtrip") == 0);
    nvs_close(handle);
    ESP_LOGI("PROBE", "NVS_ROUNDTRIP_PASS");
}

void app_main(void) {
    storage();
    oled();
    led();
    audio();
    button();
    ESP_LOGI("PROBE", "PROBE_DONE");
}
