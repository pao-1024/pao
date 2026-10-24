#include "relay_demo.h"

#include "esp_err.h"

RelayDemo::RelayDemo(gpio_num_t first, gpio_num_t second) : pins_{first, second} {
    if (!GPIO_IS_VALID_OUTPUT_GPIO(first) || !GPIO_IS_VALID_OUTPUT_GPIO(second) || first == second) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }

    // 先预置关闭电平，再启用输出，避免初始化时吸合。
    allOff();
    gpio_config_t config = {};
    config.pin_bit_mask = (1ULL << first) | (1ULL << second);
    config.mode = GPIO_MODE_OUTPUT;
    config.pull_up_en = GPIO_PULLUP_ENABLE;
    ESP_ERROR_CHECK(gpio_config(&config));
}

RelayDemo::~RelayDemo() {
    allOff();
}

void RelayDemo::setEnabled(Channel channel, bool enabled) {
    if (channel != Channel::kFirst && channel != Channel::kSecond) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }
    std::lock_guard<std::mutex> lock(mutex_);
    const auto pin = pins_[channel == Channel::kFirst ? 0 : 1];
    ESP_ERROR_CHECK(gpio_set_level(pin, enabled ? 0 : 1));
}

void RelayDemo::allOff() {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto pin : pins_) {
        ESP_ERROR_CHECK(gpio_set_level(pin, 1));
    }
}
