#pragma once

#include <cstdint>

#include "driver/mcpwm_types.h"
#include "esp_err.h"

constexpr int MCPWM_TIMER_CLK_SRC_DEFAULT = 0;
constexpr int MCPWM_TIMER_COUNT_MODE_UP = 0;
constexpr int MCPWM_TIMER_DIRECTION_UP = 0;
constexpr int MCPWM_TIMER_EVENT_EMPTY = 0;
constexpr int MCPWM_GEN_ACTION_HIGH = 1;
constexpr int MCPWM_GEN_ACTION_LOW = 0;
constexpr int MCPWM_TIMER_START_NO_STOP = 1;
constexpr int MCPWM_TIMER_STOP_EMPTY = 0;

struct mcpwm_timer_config_t {
    int group_id;
    int clk_src;
    uint32_t resolution_hz;
    int count_mode;
    uint32_t period_ticks;
};
struct mcpwm_operator_config_t { int group_id; };
struct mcpwm_comparator_config_t {
    struct { bool update_cmp_on_tez; } flags;
};
struct mcpwm_generator_config_t { int gen_gpio_num; };
struct mcpwm_gen_timer_event_action_t {
    int direction;
    int event;
    int action;
};
struct mcpwm_gen_compare_event_action_t {
    int direction;
    mcpwm_cmpr_handle_t comparator;
    int action;
};
#define MCPWM_GEN_TIMER_EVENT_ACTION(dir, ev, act) \
    (mcpwm_gen_timer_event_action_t{dir, ev, act})
#define MCPWM_GEN_COMPARE_EVENT_ACTION(dir, cmp, act) \
    (mcpwm_gen_compare_event_action_t{dir, cmp, act})

esp_err_t mcpwm_new_timer(const mcpwm_timer_config_t*, mcpwm_timer_handle_t*);
esp_err_t mcpwm_new_operator(const mcpwm_operator_config_t*, mcpwm_oper_handle_t*);
esp_err_t mcpwm_operator_connect_timer(mcpwm_oper_handle_t, mcpwm_timer_handle_t);
esp_err_t mcpwm_new_comparator(mcpwm_oper_handle_t, const mcpwm_comparator_config_t*, mcpwm_cmpr_handle_t*);
esp_err_t mcpwm_comparator_set_compare_value(mcpwm_cmpr_handle_t, uint32_t);
esp_err_t mcpwm_new_generator(mcpwm_oper_handle_t, const mcpwm_generator_config_t*, mcpwm_gen_handle_t*);
esp_err_t mcpwm_generator_set_force_level(mcpwm_gen_handle_t, int, bool);
esp_err_t mcpwm_generator_set_action_on_timer_event(mcpwm_gen_handle_t, mcpwm_gen_timer_event_action_t);
esp_err_t mcpwm_generator_set_action_on_compare_event(mcpwm_gen_handle_t, mcpwm_gen_compare_event_action_t);
esp_err_t mcpwm_timer_enable(mcpwm_timer_handle_t);
esp_err_t mcpwm_timer_start_stop(mcpwm_timer_handle_t, int);
esp_err_t mcpwm_timer_disable(mcpwm_timer_handle_t);
esp_err_t mcpwm_del_generator(mcpwm_gen_handle_t);
esp_err_t mcpwm_del_comparator(mcpwm_cmpr_handle_t);
esp_err_t mcpwm_del_operator(mcpwm_oper_handle_t);
esp_err_t mcpwm_del_timer(mcpwm_timer_handle_t);
