#pragma once

#include <cstdlib>

using esp_err_t = int;
constexpr esp_err_t ESP_OK = 0;
constexpr esp_err_t ESP_ERR_INVALID_ARG = 0x102;
#define ESP_ERROR_CHECK(expression) do { if ((expression) != ESP_OK) std::abort(); } while (0)
