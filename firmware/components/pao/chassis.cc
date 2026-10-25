#include "chassis.h"

#include <algorithm>
#include <cmath>

#include "esp_err.h"
#include "motor.h"

Chassis::Chassis(Motor& left, Motor& right) : left_(left), right_(right) {
    if (&left_ == &right_) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }
    drive(0, 0);
}

Chassis::~Chassis() {
    drive(0, 0);
}

void Chassis::drive(float forward, float turn) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!std::isfinite(forward) || !std::isfinite(turn)) {
        forward = 0;
        turn = 0;
    }
    forward = std::clamp(forward, -1.0f, 1.0f);
    turn = std::clamp(turn, -1.0f, 1.0f);

    // 差速量随前进速度减小：原地（forward=0）时为 turn，全速时减半，
    // 使边走边转时内侧轮仍同向转动，而不是停住或反转。
    const float steer = turn * (1.0f - 0.5f * std::fabs(forward));
    const float left_speed = forward - steer;
    const float right_speed = forward + steer;
    const float scale = std::max({1.0f, std::fabs(left_speed), std::fabs(right_speed)});
    left_.setSpeed(left_speed / scale);
    right_.setSpeed(right_speed / scale);
}
