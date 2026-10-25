#include "hc_sr04.h"

#include "esp_err.h"
#include "esp_rom_sys.h"
#include "esp_timer.h"
#include "freertos/task.h"

namespace {
constexpr uint32_t kResolutionHz = 1000000;
constexpr int64_t kMeasurementIntervalUs = 60000;
constexpr uint32_t kReceiveTimeoutMs = 80;
constexpr float kMicrosecondsPerCm = 58.0f;

bool onReceiveDone(rmt_channel_handle_t, const rmt_rx_done_event_data_t* event, void* context) {
    BaseType_t task_woken = pdFALSE;
    xQueueSendFromISR(static_cast<QueueHandle_t>(context), &event->num_symbols, &task_woken);
    return task_woken == pdTRUE;
}
}  // namespace

HcSr04::HcSr04(gpio_num_t trig, gpio_num_t echo) : trig_(trig), echo_(echo) {
    if (!GPIO_IS_VALID_OUTPUT_GPIO(trig) || !GPIO_IS_VALID_GPIO(echo) || trig == echo) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }

    gpio_config_t output = {};
    output.pin_bit_mask = 1ULL << trig_;
    output.mode = GPIO_MODE_OUTPUT;
    ESP_ERROR_CHECK(gpio_set_level(trig_, 0));
    ESP_ERROR_CHECK(gpio_config(&output));

    rx_queue_ = xQueueCreate(1, sizeof(size_t));
    if (rx_queue_ == nullptr) {
        ESP_ERROR_CHECK(ESP_ERR_NO_MEM);
    }

    rmt_rx_channel_config_t rx_config = {};
    rx_config.gpio_num = echo_;
    rx_config.clk_src = RMT_CLK_SRC_DEFAULT;
    rx_config.resolution_hz = kResolutionHz;
    rx_config.mem_block_symbols = 64;
    ESP_ERROR_CHECK(rmt_new_rx_channel(&rx_config, &rx_channel_));
    ESP_ERROR_CHECK(gpio_set_pull_mode(echo_, GPIO_PULLDOWN_ONLY));

    rmt_rx_event_callbacks_t callbacks = {};
    callbacks.on_recv_done = onReceiveDone;
    ESP_ERROR_CHECK(rmt_rx_register_event_callbacks(rx_channel_, &callbacks, rx_queue_));
}

HcSr04::~HcSr04() {
    ESP_ERROR_CHECK(gpio_set_level(trig_, 0));
    ESP_ERROR_CHECK(rmt_del_channel(rx_channel_));
    vQueueDelete(rx_queue_);
}

esp_err_t HcSr04::readDistanceCm(float& distance_cm) {
    std::lock_guard<std::mutex> lock(mutex_);
    const int64_t remaining_us = last_trigger_us_ + kMeasurementIntervalUs - esp_timer_get_time();
    if (last_trigger_us_ != 0 && remaining_us > 0) {
        vTaskDelay(pdMS_TO_TICKS((remaining_us + 999) / 1000) + 1);
    }
    if (gpio_get_level(echo_) != 0) {
        return ESP_ERR_INVALID_STATE;
    }

    xQueueReset(rx_queue_);
    esp_err_t error = rmt_enable(rx_channel_);
    if (error != ESP_OK) {
        return error;
    }

    rmt_receive_config_t receive_config = {};
    receive_config.signal_range_min_ns = 1000;
    // 1us 分辨率下每段最多 32767 ticks；30ms 覆盖 4m 回波且不溢出。
    receive_config.signal_range_max_ns = 30000000;
    error = rmt_receive(rx_channel_, symbols_, sizeof(symbols_), &receive_config);
    size_t symbol_count = 0;
    if (error == ESP_OK) {
        esp_rom_delay_us(2);
        last_trigger_us_ = esp_timer_get_time();
        ESP_ERROR_CHECK(gpio_set_level(trig_, 1));
        esp_rom_delay_us(10);
        ESP_ERROR_CHECK(gpio_set_level(trig_, 0));

        if (xQueueReceive(rx_queue_, &symbol_count, pdMS_TO_TICKS(kReceiveTimeoutMs) + 1) != pdTRUE) {
            error = ESP_ERR_TIMEOUT;
        }
    }
    // 超时同样停止接收，避免上一轮回波进入下一次测量。
    ESP_ERROR_CHECK(rmt_disable(rx_channel_));
    if (error != ESP_OK) {
        return error;
    }
    if (symbol_count >= sizeof(symbols_) / sizeof(symbols_[0])) {
        return ESP_ERR_INVALID_RESPONSE;
    }

    uint32_t pulse_us = 0;
    size_t pulse_count = 0;
    for (size_t i = 0; i < symbol_count; ++i) {
        const auto& symbol = symbols_[i];
        if (symbol.level0 && symbol.duration0 != 0) {
            pulse_us += symbol.duration0;
            ++pulse_count;
        }
        if (symbol.level1 && symbol.duration1 != 0) {
            pulse_us += symbol.duration1;
            ++pulse_count;
        }
    }
    if (pulse_count == 0) {
        return ESP_ERR_TIMEOUT;
    }
    const float measured_cm = pulse_us / kMicrosecondsPerCm;
    if (pulse_count != 1 || measured_cm < 2.0f || measured_cm > 400.0f) {
        return ESP_ERR_INVALID_RESPONSE;
    }
    distance_cm = measured_cm;
    return ESP_OK;
}
