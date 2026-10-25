#include "launcher.h"

#include "esp_err.h"
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

Launcher::Launcher(gpio_num_t fire_gpio) : fire_gpio_(fire_gpio) {
    if (!GPIO_IS_VALID_OUTPUT_GPIO(fire_gpio)) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }

    configureOutput(fire_gpio_, kInactiveLevel);
}

Launcher::~Launcher() {
    safeOff();
}

void Launcher::fire() {
    std::lock_guard<std::mutex> lock(mutex_);
    ESP_ERROR_CHECK(gpio_set_level(fire_gpio_, kActiveLevel));
    vTaskDelay(pdMS_TO_TICKS(kFirePulseMs));
    ESP_ERROR_CHECK(gpio_set_level(fire_gpio_, kInactiveLevel));
}

void Launcher::safeOff() {
    std::lock_guard<std::mutex> lock(mutex_);
    ESP_ERROR_CHECK(gpio_set_level(fire_gpio_, kInactiveLevel));
}
