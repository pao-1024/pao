#include "launcher.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace {

// 继电器模块为低电平吸合，断开时输出高电平。
constexpr uint32_t kActiveLevel = 0;
constexpr uint32_t kInactiveLevel = 1;

// 先写输出寄存器再切换为输出方向，避免切换瞬间出现低电平毛刺被继电器当作一次吸合。
void configureOutput(gpio_num_t pin, uint32_t level) {
    gpio_config_t config = {};
    config.pin_bit_mask = 1ULL << pin;
    config.mode = GPIO_MODE_OUTPUT;
    ESP_ERROR_CHECK(gpio_set_level(pin, level));
    ESP_ERROR_CHECK(gpio_config(&config));
}

}  // namespace

Launcher::Launcher(gpio_num_t charge_gpio, gpio_num_t fire_gpio)
    : charge_gpio_(charge_gpio), fire_gpio_(fire_gpio) {
    if (!GPIO_IS_VALID_OUTPUT_GPIO(charge_gpio) || !GPIO_IS_VALID_OUTPUT_GPIO(fire_gpio) ||
        charge_gpio == fire_gpio) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }

    configureOutput(charge_gpio_, kInactiveLevel);
    configureOutput(fire_gpio_, kInactiveLevel);
}

Launcher::~Launcher() {
    safeOff();
}

void Launcher::setCharging(bool on) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (on == charging_) {
        return;
    }
    ESP_ERROR_CHECK(gpio_set_level(charge_gpio_, on ? kActiveLevel : kInactiveLevel));
    charging_ = on;
}

bool Launcher::isCharging() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return charging_;
}

esp_err_t Launcher::fire() {
    std::lock_guard<std::mutex> lock(mutex_);
    // 充能期间升压仍在向储能电容灌电流，此时触发会把能量直接泄进 SCR 与线圈。
    if (charging_) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_ERROR_CHECK(gpio_set_level(fire_gpio_, kActiveLevel));
    vTaskDelay(pdMS_TO_TICKS(kFirePulseMs));
    ESP_ERROR_CHECK(gpio_set_level(fire_gpio_, kInactiveLevel));
    return ESP_OK;
}

void Launcher::safeOff() {
    std::lock_guard<std::mutex> lock(mutex_);
    ESP_ERROR_CHECK(gpio_set_level(charge_gpio_, kInactiveLevel));
    ESP_ERROR_CHECK(gpio_set_level(fire_gpio_, kInactiveLevel));
    charging_ = false;
}
