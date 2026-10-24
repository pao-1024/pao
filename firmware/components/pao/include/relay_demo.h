#pragma once

#include <mutex>

#include "driver/gpio.h"

// 两路低电平吸合的继电器，仅用于低压指示灯演示。
class RelayDemo {
public:
    enum class Channel { kFirst, kSecond };

    // GPIO 必须不同且支持输出。构造和析构时关闭两路。
    RelayDemo(gpio_num_t first, gpio_num_t second);
    ~RelayDemo();

    RelayDemo(const RelayDemo&) = delete;
    RelayDemo& operator=(const RelayDemo&) = delete;

    // enabled 为 true 时闭合对应常开触点。仅在普通任务中调用。
    void setEnabled(Channel channel, bool enabled);
    void allOff();

private:
    gpio_num_t pins_[2];
    std::mutex mutex_;
};
