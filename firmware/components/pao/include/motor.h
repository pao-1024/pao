#pragma once

#include <mutex>

#include "driver/gpio.h"
#include "driver/mcpwm_types.h"

class Motor {
public:
    // 两根 GPIO 分别连接 MX1508 同一路的 IN1/IN2，构造后保持停止。
    Motor(gpio_num_t in1, gpio_num_t in2);
    ~Motor();

    Motor(const Motor&) = delete;
    Motor& operator=(const Motor&) = delete;

    // speed ∈ [-1, 1]：正负表示方向，绝对值为占空比，0 为滑行停止。
    // 越界值限幅；NaN、无穷值按停止处理。不能在 ISR 中调用。
    void setSpeed(float speed);

private:
    gpio_num_t pins_[2];
    mcpwm_timer_handle_t timer_ = nullptr;
    mcpwm_oper_handle_t operator_ = nullptr;
    mcpwm_cmpr_handle_t comparator_ = nullptr;
    mcpwm_gen_handle_t generators_[2] = {};
    std::mutex mutex_;
};
