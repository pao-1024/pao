#include "chassis.h"

#include <algorithm>
#include <cmath>

#include "esp_err.h"
#include "motor.h"

Chassis::Chassis(Motor& left, Motor& right) : left_(left), right_(right) {
    if (&left_ == &right_) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }
    stop();
}

Chassis::~Chassis() {
    stop();
}

void Chassis::drive(float forward, float turn) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!std::isfinite(forward) || !std::isfinite(turn)) {
        forward = 0;
        turn = 0;
    }
    forward = std::clamp(forward, -1.0f, 1.0f);
    turn = std::clamp(turn, -1.0f, 1.0f);

    const float left_speed = forward - turn;
    const float right_speed = forward + turn;
    const float scale = std::max({1.0f, std::fabs(left_speed), std::fabs(right_speed)});
    left_.setSpeed(left_speed / scale);
    right_.setSpeed(right_speed / scale);
}

void Chassis::stop() {
    drive(0, 0);
}
