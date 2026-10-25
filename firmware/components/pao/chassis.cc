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
    if (!std::isfinite(forward) || !std::isfinite(turn)) {
        forward = 0;
        turn = 0;
    }
    forward = std::clamp(forward, -1.0f, 1.0f);
    turn = std::clamp(turn, -1.0f, 1.0f);
    const auto [left, right] = Mix(forward, turn);
    driveWheels(left, right);
}

std::pair<float, float> Chassis::Mix(float forward, float turn) {
    // 差速量随前进速度减小：原地（forward=0）时为 turn，全速时减半，
    // 使边走边转时内侧轮仍同向转动，而不是停住或反转。
    const float steer = turn * (1.0f - 0.5f * std::fabs(forward));
    const float left_speed = forward - steer;
    const float right_speed = forward + steer;
    const float scale = std::max({1.0f, std::fabs(left_speed), std::fabs(right_speed)});
    return {left_speed / scale, right_speed / scale};
}

void Chassis::driveWheels(float left, float right) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!std::isfinite(left) || !std::isfinite(right)) {
        left = right = 0;
    }
    const auto [limited_left, limited_right] = Limit(std::clamp(left, -1.0f, 1.0f), std::clamp(right, -1.0f, 1.0f));
    left_.setSpeed(limited_left * left_gain_ / 1000.0f);
    right_.setSpeed(limited_right * right_gain_ / 1000.0f);
}

std::pair<float, float> Chassis::Limit(float left, float right) const {
    // 分别缩放平移和差速分量，使直接控制两轮也不能绕过速度上限；之后再补偿电机差异。
    const float linear = (left + right) * 0.5f * linear_limit_ / 100.0f;
    const float turn = (right - left) * 0.5f * turn_limit_ / 100.0f;
    return {linear - turn, linear + turn};
}

bool Chassis::setSpeedLimits(int linear, int turn) {
    if (linear < 0 || linear > 100 || turn < 0 || turn > 100) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    linear_limit_ = linear;
    turn_limit_ = turn;
    return true;
}

std::pair<int, int> Chassis::speedLimits() {
    std::lock_guard<std::mutex> lock(mutex_);
    return {linear_limit_, turn_limit_};
}

bool Chassis::setWheelCalibration(int left, int right) {
    if (left < 100 || left > 1000 || right < 100 || right > 1000) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    left_gain_ = left;
    right_gain_ = right;
    return true;
}

std::pair<int, int> Chassis::wheelCalibration() {
    std::lock_guard<std::mutex> lock(mutex_);
    return {left_gain_, right_gain_};
}

bool Chassis::calibrateForward(float forward, float turn) {
    if (!std::isfinite(forward) || !std::isfinite(turn) || forward <= 0 || forward > 1 || std::fabs(turn) > 1) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    const auto mixed = Mix(forward, turn);
    const auto [left, right] = Limit(mixed.first, mixed.second);
    if (left <= 0 || right <= 0) {
        return false;
    }
    // 用户已用这组转向补偿走直；合并现有校正后归一化，避免要求电机超额输出。
    const float l = left * left_gain_, r = right * right_gain_;
    const float scale = std::max(l, r);
    const int left_gain = std::lround(l / scale * 1000), right_gain = std::lround(r / scale * 1000);
    if (left_gain < 100 || right_gain < 100) {
        return false;
    }
    left_gain_ = left_gain;
    right_gain_ = right_gain;
    return true;
}
