#pragma once

#include <cstdint>
#include <mutex>

#include "driver/gpio.h"
#include "esp_err.h"

class Launcher {
public:
    // 发射继电器保持吸合的时长，覆盖继电器吸合抖动并远大于 SCR 的门极开通需求。
    static constexpr uint32_t kFirePulseMs = 100;

    // charge_gpio 驱动充能继电器，fire_gpio 驱动发射继电器，两路均为低电平吸合。
    // 构造时先写断开电平再启用输出，上电不会误吸合。
    Launcher(gpio_num_t charge_gpio, gpio_num_t fire_gpio);
    ~Launcher();

    Launcher(const Launcher&) = delete;
    Launcher& operator=(const Launcher&) = delete;

    // 充能继电器为保持型开关，重复设置同一状态不会额外切换。
    void setCharging(bool on);
    bool isCharging() const;

    // 充能中拒绝发射并返回 ESP_ERR_INVALID_STATE，不产生门极脉冲。
    // 成功时保持发射继电器吸合约 kFirePulseMs 后释放并返回 ESP_OK。
    // 调用期间独占驱动，其他调用会等待脉冲结束。不能在 ISR 中调用。
    esp_err_t fire();

    // 断开两路继电器，可重复调用；析构时同样执行。
    void safeOff();

private:
    gpio_num_t charge_gpio_;
    gpio_num_t fire_gpio_;
    bool charging_ = false;
    mutable std::mutex mutex_;
};
