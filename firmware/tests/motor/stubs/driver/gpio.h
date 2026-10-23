#pragma once

#include <cstdint>

#include "esp_err.h"

using gpio_num_t = int;
constexpr int GPIO_MODE_OUTPUT = 1;
#define GPIO_IS_VALID_OUTPUT_GPIO(pin) ((pin) >= 0 && (pin) < 49)

struct gpio_config_t {
    uint64_t pin_bit_mask;
    int mode;
};

esp_err_t gpio_set_level(gpio_num_t pin, unsigned level);
esp_err_t gpio_config(const gpio_config_t* config);
