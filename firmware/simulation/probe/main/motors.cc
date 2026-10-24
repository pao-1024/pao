#include <cassert>
#include <limits>

#include "chassis.h"
#include "motor.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

extern "C" void motor_driver_probe(void) {
    Motor right(GPIO_NUM_11, GPIO_NUM_12);
    Motor left(GPIO_NUM_13, GPIO_NUM_14);
    Chassis chassis(left, right);
    const float nan = std::numeric_limits<float>::quiet_NaN();
    const float inf = std::numeric_limits<float>::infinity();
    const float commands[][2] = {
        {0, 0}, {.25f, -.5f}, {-.75f, .125f}, {1, -1}, {-1, 1},
        {2, -2}, {nan, inf}, {.001f, -.999f}, {0, 0},
        {1, 0}, {-1, 0}, {0, 1}, {.5f, .25f}, {1, 1}, {nan, 1}, {0, 0}
    };
    for (unsigned stage = 0; stage < 16; stage++) {
        if (stage < 9) {
            right.setSpeed(commands[stage][0]);
            left.setSpeed(commands[stage][1]);
        } else {
            chassis.drive(commands[stage][0], commands[stage][1]);
        }
        ESP_LOGI("PROBE", "PWM_STAGE value=%u;", stage);
        unsigned ticks = 0;
        while (gpio_get_level(GPIO_NUM_0) && ticks++ < 5000) vTaskDelay(1);
        assert(!gpio_get_level(GPIO_NUM_0));
        ESP_LOGI("PROBE", "PWM_ACK value=%u;", stage);
        ticks = 0;
        while (!gpio_get_level(GPIO_NUM_0) && ticks++ < 5000) vTaskDelay(1);
        assert(gpio_get_level(GPIO_NUM_0));
    }
}
