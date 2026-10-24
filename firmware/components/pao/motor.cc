#include "motor.h"

#include <algorithm>
#include <cmath>

#include "driver/mcpwm_prelude.h"
#include "esp_err.h"

namespace {
constexpr uint32_t kResolutionHz = 1000000;
constexpr uint32_t kPwmFrequencyHz = 1000;
constexpr uint32_t kPeriodTicks = kResolutionHz / kPwmFrequencyHz;

void configureOutputLow(gpio_num_t pin) {
    gpio_config_t config = {};
    config.pin_bit_mask = 1ULL << pin;
    config.mode = GPIO_MODE_OUTPUT;
    ESP_ERROR_CHECK(gpio_set_level(pin, 0));
    ESP_ERROR_CHECK(gpio_config(&config));
}
}  // namespace

Motor::Motor(gpio_num_t in1, gpio_num_t in2) : pins_{in1, in2} {
    if (!GPIO_IS_VALID_OUTPUT_GPIO(in1) || !GPIO_IS_VALID_OUTPUT_GPIO(in2) || in1 == in2) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }

    for (auto pin : pins_) {
        configureOutputLow(pin);
    }

    mcpwm_timer_config_t timer_config = {};
    timer_config.group_id = 0;
    timer_config.clk_src = MCPWM_TIMER_CLK_SRC_DEFAULT;
    timer_config.resolution_hz = kResolutionHz;
    timer_config.count_mode = MCPWM_TIMER_COUNT_MODE_UP;
    timer_config.period_ticks = kPeriodTicks;
    ESP_ERROR_CHECK(mcpwm_new_timer(&timer_config, &timer_));

    mcpwm_operator_config_t operator_config = {};
    operator_config.group_id = timer_config.group_id;
    ESP_ERROR_CHECK(mcpwm_new_operator(&operator_config, &operator_));
    ESP_ERROR_CHECK(mcpwm_operator_connect_timer(operator_, timer_));

    mcpwm_comparator_config_t comparator_config = {};
    comparator_config.flags.update_cmp_on_tez = true;
    ESP_ERROR_CHECK(mcpwm_new_comparator(operator_, &comparator_config, &comparator_));
    ESP_ERROR_CHECK(mcpwm_comparator_set_compare_value(comparator_, 0));

    for (int i = 0; i < 2; ++i) {
        mcpwm_generator_config_t generator_config = {};
        generator_config.gen_gpio_num = pins_[i];
        ESP_ERROR_CHECK(mcpwm_new_generator(operator_, &generator_config, &generators_[i]));
        ESP_ERROR_CHECK(mcpwm_generator_set_force_level(generators_[i], 0, true));
        ESP_ERROR_CHECK(mcpwm_generator_set_action_on_timer_event(
            generators_[i], MCPWM_GEN_TIMER_EVENT_ACTION(
                MCPWM_TIMER_DIRECTION_UP, MCPWM_TIMER_EVENT_EMPTY, MCPWM_GEN_ACTION_HIGH)));
        ESP_ERROR_CHECK(mcpwm_generator_set_action_on_compare_event(
            generators_[i], MCPWM_GEN_COMPARE_EVENT_ACTION(
                MCPWM_TIMER_DIRECTION_UP, comparator_, MCPWM_GEN_ACTION_LOW)));
    }

    ESP_ERROR_CHECK(mcpwm_timer_enable(timer_));
    ESP_ERROR_CHECK(mcpwm_timer_start_stop(timer_, MCPWM_TIMER_START_NO_STOP));
}

Motor::~Motor() {
    setSpeed(0);
    ESP_ERROR_CHECK(mcpwm_timer_start_stop(timer_, MCPWM_TIMER_STOP_EMPTY));
    ESP_ERROR_CHECK(mcpwm_timer_disable(timer_));
    for (int i = 0; i < 2; ++i) {
        ESP_ERROR_CHECK(mcpwm_del_generator(generators_[i]));
        // 重新配置 GPIO 矩阵，防止引脚继续跟随已释放的 PWM 资源。
        configureOutputLow(pins_[i]);
    }
    ESP_ERROR_CHECK(mcpwm_del_comparator(comparator_));
    ESP_ERROR_CHECK(mcpwm_del_operator(operator_));
    ESP_ERROR_CHECK(mcpwm_del_timer(timer_));
}

void Motor::setSpeed(float speed) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!std::isfinite(speed)) {
        speed = 0;
    }
    speed = std::clamp(speed, -1.0f, 1.0f);

    const int direction = speed < 0 ? 1 : 0;
    const auto active = generators_[direction];
    // 强制低电平立即生效，换向时先关闭原方向输出。
    ESP_ERROR_CHECK(mcpwm_generator_set_force_level(generators_[1 - direction], 0, true));

    const auto duty = static_cast<uint32_t>(std::lround(std::fabs(speed) * kPeriodTicks));
    if (duty == 0 || duty == kPeriodTicks) {
        ESP_ERROR_CHECK(mcpwm_generator_set_force_level(active, duty != 0, true));
    } else {
        ESP_ERROR_CHECK(mcpwm_comparator_set_compare_value(comparator_, duty));
        ESP_ERROR_CHECK(mcpwm_generator_set_force_level(active, -1, true));
    }
}
