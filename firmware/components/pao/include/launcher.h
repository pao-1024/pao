#pragma once

#include <cstdint>
#include <mutex>

#include "driver/gpio.h"

class Launcher {
public:
    // 发射继电器保持吸合的时长：覆盖触点抖动，足以让发射器识别为一次按下，
    // 又不至于让按钮长时间处于按下状态。
    static constexpr uint32_t kFirePulseMs = 300;

    // fire_gpio 短接发射器的发射按钮，低电平吸合。
    // 构造时先写断开电平再启用输出，上电不会误按下按钮。
    explicit Launcher(gpio_num_t fire_gpio);
    ~Launcher();

    Launcher(const Launcher&) = delete;
    Launcher& operator=(const Launcher&) = delete;

    // 保持发射继电器吸合约 kFirePulseMs 后释放。
    // 发射器由硬件常供电并持续充能，因此每次调用都会触发一次发射，
    // 是否已充满由调用方把握。调用期间独占驱动，其他调用会等待脉冲结束。
    // 不能在 ISR 中调用。
    void fire();

    // 断开继电器，可重复调用；析构时同样执行。
    void safeOff();

private:
    gpio_num_t fire_gpio_;
    mutable std::mutex mutex_;
};
