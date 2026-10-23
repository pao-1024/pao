#include "motor.h"

#include <array>
#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <thread>
#include <type_traits>

#include "driver/mcpwm_prelude.h"

// 只替换硬件边界；编译并调用真实 Motor，检查每次输出变化后的状态。
struct FakeTimer { uint32_t period; bool enabled = false; bool running = false; };
struct FakeComparator { FakeTimer* timer; uint32_t compare = 0; };
struct FakeGenerator {
    FakeOperator* oper;
    int pin;
    int force = 0;
    bool high_on_empty = false;
    FakeComparator* low_on_compare = nullptr;
};
struct FakeOperator {
    FakeTimer* timer = nullptr;
    std::array<FakeGenerator*, 2> generators = {};
};

static std::array<FakeGenerator*, 49> outputs = {};
static std::array<unsigned, 49> gpio_levels = {};
static std::array<bool, 49> simple_gpio = {};
static int live_resources = 0;

static float duty(int pin) {
    const auto gen = outputs.at(pin);
    if (simple_gpio.at(pin)) return static_cast<float>(gpio_levels.at(pin));
    assert(gen);
    if (gen->force >= 0) return static_cast<float>(gen->force);
    assert(gen->oper->timer->running && gen->high_on_empty && gen->low_on_compare);
    return static_cast<float>(gen->low_on_compare->compare) / gen->oper->timer->period;
}

static void checkNoOverlap(FakeOperator* oper) {
    const auto& generators = oper->generators;
    if (generators[0] && generators[1]) {
        assert(duty(generators[0]->pin) == 0 || duty(generators[1]->pin) == 0);
    }
}

esp_err_t gpio_set_level(gpio_num_t pin, unsigned level) {
    gpio_levels.at(pin) = level;
    return ESP_OK;
}
esp_err_t gpio_config(const gpio_config_t* config) {
    assert(config->mode == GPIO_MODE_OUTPUT);
    for (int pin = 0; pin < 49; ++pin) {
        if (config->pin_bit_mask & (1ULL << pin)) simple_gpio.at(pin) = true;
    }
    return ESP_OK;
}
esp_err_t mcpwm_new_timer(const mcpwm_timer_config_t* config, mcpwm_timer_handle_t* timer) {
    assert(config->resolution_hz > 0 && config->period_ticks > 0);
    *timer = new FakeTimer{config->period_ticks};
    ++live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_new_operator(const mcpwm_operator_config_t*, mcpwm_oper_handle_t* oper) {
    *oper = new FakeOperator;
    ++live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_operator_connect_timer(mcpwm_oper_handle_t oper, mcpwm_timer_handle_t timer) {
    oper->timer = timer;
    return ESP_OK;
}
esp_err_t mcpwm_new_comparator(mcpwm_oper_handle_t oper, const mcpwm_comparator_config_t*, mcpwm_cmpr_handle_t* cmpr) {
    *cmpr = new FakeComparator{oper->timer};
    ++live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_comparator_set_compare_value(mcpwm_cmpr_handle_t cmpr, uint32_t value) {
    assert(value < cmpr->timer->period);
    cmpr->compare = value;
    return ESP_OK;
}
esp_err_t mcpwm_new_generator(mcpwm_oper_handle_t oper, const mcpwm_generator_config_t* config, mcpwm_gen_handle_t* gen) {
    assert(!outputs.at(config->gen_gpio_num));
    *gen = new FakeGenerator{oper, config->gen_gpio_num};
    outputs.at(config->gen_gpio_num) = *gen;
    simple_gpio.at(config->gen_gpio_num) = false;
    auto& slot = oper->generators[oper->generators[0] ? 1 : 0];
    assert(!slot);
    slot = *gen;
    ++live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_generator_set_force_level(mcpwm_gen_handle_t gen, int level, bool hold) {
    assert(level >= -1 && level <= 1 && hold);
    gen->force = level;
    checkNoOverlap(gen->oper);
    return ESP_OK;
}
esp_err_t mcpwm_generator_set_action_on_timer_event(mcpwm_gen_handle_t gen, mcpwm_gen_timer_event_action_t action) {
    assert(action.direction == MCPWM_TIMER_DIRECTION_UP && action.event == MCPWM_TIMER_EVENT_EMPTY);
    gen->high_on_empty = action.action == MCPWM_GEN_ACTION_HIGH;
    return ESP_OK;
}
esp_err_t mcpwm_generator_set_action_on_compare_event(mcpwm_gen_handle_t gen, mcpwm_gen_compare_event_action_t action) {
    assert(action.direction == MCPWM_TIMER_DIRECTION_UP && action.action == MCPWM_GEN_ACTION_LOW);
    gen->low_on_compare = action.comparator;
    return ESP_OK;
}
esp_err_t mcpwm_timer_enable(mcpwm_timer_handle_t timer) {
    assert(!timer->enabled);
    timer->enabled = true;
    return ESP_OK;
}
esp_err_t mcpwm_timer_start_stop(mcpwm_timer_handle_t timer, int command) {
    assert(timer->enabled);
    timer->running = command == MCPWM_TIMER_START_NO_STOP;
    return ESP_OK;
}
esp_err_t mcpwm_timer_disable(mcpwm_timer_handle_t timer) {
    assert(timer->enabled && !timer->running);
    timer->enabled = false;
    return ESP_OK;
}
esp_err_t mcpwm_del_generator(mcpwm_gen_handle_t gen) {
    assert(duty(gen->pin) == 0);
    outputs.at(gen->pin) = nullptr;
    for (auto& slot : gen->oper->generators) {
        if (slot == gen) slot = nullptr;
    }
    delete gen;
    --live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_del_comparator(mcpwm_cmpr_handle_t cmpr) {
    delete cmpr;
    --live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_del_operator(mcpwm_oper_handle_t oper) {
    assert(!oper->generators[0] && !oper->generators[1]);
    delete oper;
    --live_resources;
    return ESP_OK;
}
esp_err_t mcpwm_del_timer(mcpwm_timer_handle_t timer) {
    assert(!timer->enabled && !timer->running);
    delete timer;
    --live_resources;
    return ESP_OK;
}

int main() {
    static_assert(!std::is_copy_constructible_v<Motor> && !std::is_move_constructible_v<Motor>);
    {
        Motor right(11, 12);
        Motor left(13, 14);
        assert(duty(11) == 0 && duty(12) == 0 && duty(13) == 0 && duty(14) == 0);
        left.setSpeed(-0.75f);

        struct TestCase { float speed; float forward; float reverse; };
        const TestCase cases[] = {
            {0.5f, 0.5f, 0}, {-0.25f, 0, 0.25f}, {1, 1, 0}, {-1, 0, 1},
            {0, 0, 0}, {-0.5f, 0, 0.5f}, {-0.0f, 0, 0},
            {2, 1, 0}, {-2, 0, 1}, {0.0001f, 0, 0}, {-0.0001f, 0, 0},
            {std::numeric_limits<float>::quiet_NaN(), 0, 0},
            {std::numeric_limits<float>::infinity(), 0, 0},
            {-std::numeric_limits<float>::infinity(), 0, 0},
        };
        for (const auto& test : cases) {
            right.setSpeed(test.speed);
            assert(std::fabs(duty(11) - test.forward) < 0.0001f);
            assert(std::fabs(duty(12) - test.reverse) < 0.0001f);
            assert(duty(13) == 0 && duty(14) == 0.75f);
        }

        auto update = [&right](float speed) {
            for (int i = 0; i < 1000; ++i) right.setSpeed(speed);
        };
        std::thread forward(update, 1.0f);
        std::thread reverse(update, -1.0f);
        forward.join();
        reverse.join();
        // 带输出离开作用域，验证析构停止并释放资源。
        right.setSpeed(1);
    }
    assert(live_resources == 0);
    assert(duty(11) == 0 && duty(12) == 0 && duty(13) == 0 && duty(14) == 0);
    {
        Motor reused(11, 12);
        reused.setSpeed(-1);
        assert(duty(11) == 0 && duty(12) == 1);
    }
    assert(live_resources == 0);
    std::cout << "Motor tests passed\n";
}
