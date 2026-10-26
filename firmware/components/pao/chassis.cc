#include "chassis.h"

#include <cmath>

#include "esp_err.h"
#include "motor.h"

Chassis::Chassis(Motor& left, Motor& right) : left_(left), right_(right) {
    if (&left_ == &right_) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }
    left_.setSpeed(0);
    right_.setSpeed(0);
}

Chassis::~Chassis() {
    stop();
}

bool Chassis::validConfig(const ChassisConfig& config) {
    return std::isfinite(config.left_scale) &&
           std::isfinite(config.right_scale) && config.left_scale >= 0 &&
           config.left_scale <= 1 && config.right_scale >= 0 && config.right_scale <= 1 &&
           std::isfinite(config.move_output) && config.move_output >= 0.2f && config.move_output <= 1 &&
           std::isfinite(config.rotate_output) && config.rotate_output >= 0.2f && config.rotate_output <= 1;
}

bool Chassis::setConfig(const ChassisConfig& config) {
    if (!validConfig(config)) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    config_ = config;
    writeMotorsLocked();
    return true;
}

ChassisConfig Chassis::config() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return config_;
}

void Chassis::setMotion(Motion motion, int direction) {
    std::lock_guard<std::mutex> lock(mutex_);
    motion_ = motion;
    direction_ = direction;
    writeMotorsLocked();
}

void Chassis::forward() {
    setMotion(Motion::Move, 1);
}

void Chassis::backward() {
    setMotion(Motion::Move, -1);
}

void Chassis::turnLeft() {
    setMotion(Motion::Rotate, 1);
}

void Chassis::turnRight() {
    setMotion(Motion::Rotate, -1);
}

void Chassis::stop() {
    setMotion(Motion::Stopped, 0);
}

void Chassis::emergencyStop() {
    stop();
}

void Chassis::writeMotorsLocked() {
    const float motion_max = motion_ == Motion::Rotate ? config_.rotate_output : config_.move_output;
    const float speed = direction_ * motion_max;
    const float left = speed * config_.left_scale * (motion_ == Motion::Rotate ? -1.0f : 1.0f);
    const float right = speed * config_.right_scale;
    if (left != last_left_output_) {
        left_.setSpeed(left);
        last_left_output_ = left;
    }
    if (right != last_right_output_) {
        right_.setSpeed(right);
        last_right_output_ = right;
    }
}
