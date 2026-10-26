#pragma once

#include <cstdint>
#include <mutex>

#include "driver/gpio.h"
#include "driver/rmt_rx.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

class HcSr04 {
public:
    // 仅接支持 3.3V 供电及信号电平的模块；Trig 输出、Echo 输入。
    HcSr04(gpio_num_t trig, gpio_num_t echo);
    ~HcSr04();

    HcSr04(const HcSr04&) = delete;
    HcSr04& operator=(const HcSr04&) = delete;

    // 同步测距，成功写入厘米值（2–400cm），失败时不修改 distance_cm。
    // 无回波返回 ESP_ERR_TIMEOUT，异常波形返回 ESP_ERR_INVALID_RESPONSE，
    // Echo 未恢复低电平返回 ESP_ERR_INVALID_STATE。连续触发至少间隔 60ms。
    // 同一实例串行执行；只能从普通任务调用，不能在 ISR 中调用。
    esp_err_t readDistanceCm(float& distance_cm);

private:
    gpio_num_t trig_;
    gpio_num_t echo_;
    rmt_channel_handle_t rx_channel_ = nullptr;
    QueueHandle_t rx_queue_ = nullptr;
    rmt_symbol_word_t symbols_[64] = {};
    int64_t last_trigger_us_ = 0;
    std::mutex mutex_;
};
