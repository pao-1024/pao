#include "chassis.h"

#include <algorithm>
#include <cmath>

#include "esp_err.h"
#include "esp_timer.h"
#include "motor.h"

namespace {
constexpr TickType_t kUpdateTicks = pdMS_TO_TICKS(20);
constexpr int64_t kStartBoostUs = 80000;

float approach(float current, float target, float step) {
    return current + std::clamp(target - current, -step, step);
}

float applyMinOutput(float speed, float scale, float motion_max, float min_output) {
    if (speed == 0 || scale == 0 || min_output == 0) {
        return speed * scale;
    }
    const float full_output = std::max(std::abs(speed), motion_max);
    const float wheel_max = full_output * scale;
    const float wheel_min = std::min(min_output, wheel_max);
    const float progress = std::abs(speed) / full_output;
    return std::copysign(wheel_min + (wheel_max - wheel_min) * progress, speed);
}

// 起步脉冲允许短暂高于持续输出上限，以克服轮子的静摩擦。
float applyStartBoost(float output, float previous_output, float boost_output, int64_t now_us,
                      int64_t& deadline_us, bool moving_toward_target) {
    if (output == 0 || boost_output == 0 || !moving_toward_target || output * previous_output < 0) {
        deadline_us = 0;
        return output;
    }
    if (previous_output == 0) {
        deadline_us = now_us + kStartBoostUs;
    }
    if (now_us < deadline_us) {
        return std::copysign(std::max(std::abs(output), boost_output), output);
    }
    deadline_us = 0;
    return output;
}
}  // namespace

Chassis::Chassis(Motor& left, Motor& right) : left_(left), right_(right) {
    if (&left_ == &right_) {
        ESP_ERROR_CHECK(ESP_ERR_INVALID_ARG);
    }
    left_.setSpeed(0);
    right_.setSpeed(0);
    task_stopped_ = xSemaphoreCreateBinary();
    ESP_ERROR_CHECK(task_stopped_ ? ESP_OK : ESP_ERR_NO_MEM);
    ESP_ERROR_CHECK(xTaskCreate(taskEntry, "chassis", 4096, this, 5, &task_) == pdPASS
                        ? ESP_OK : ESP_ERR_NO_MEM);
}

Chassis::~Chassis() {
    emergencyStop();
    {
        std::lock_guard<std::mutex> lock(mutex_);
        running_ = false;
    }
    xTaskNotifyGive(task_);
    xSemaphoreTake(task_stopped_, portMAX_DELAY);
    vSemaphoreDelete(task_stopped_);
}

bool Chassis::validConfig(const ChassisConfig& config) {
    return config.ramp_time_ms <= 3000 && std::isfinite(config.left_scale) &&
           std::isfinite(config.right_scale) && config.left_scale >= 0 &&
           config.left_scale <= 1 && config.right_scale >= 0 && config.right_scale <= 1 &&
           std::isfinite(config.move_output) && config.move_output >= 0.2f && config.move_output <= 1 &&
           std::isfinite(config.rotate_output) && config.rotate_output >= 0.2f && config.rotate_output <= 1 &&
           std::isfinite(config.min_output) && config.min_output >= 0 &&
           config.min_output < config.move_output && config.min_output < config.rotate_output &&
           std::isfinite(config.start_boost_output) && config.start_boost_output >= 0 &&
           config.start_boost_output <= 1;
}

bool Chassis::setConfig(const ChassisConfig& config) {
    if (!validConfig(config)) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    config_ = config;
    left_boost_deadline_us_ = 0;
    right_boost_deadline_us_ = 0;
    if (target_speed_ != 0) {
        const float output = std::min(requested_ == Motion::Rotate ? config_.rotate_output : config_.move_output,
                                      output_limit_);
        target_speed_ = std::copysign(output, target_speed_);
    }
    if (config_.ramp_time_ms == 0) {
        advanceLocked(0);
    } else {
        writeMotorsLocked();
    }
    xTaskNotifyGive(task_);
    return true;
}

ChassisConfig Chassis::config() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return config_;
}

void Chassis::setMotion(Motion motion, int direction, float output_limit) {
    std::lock_guard<std::mutex> lock(mutex_);
    const bool changed = motion != requested_ || direction * target_speed_ <= 0;
    requested_ = motion;
    output_limit_ = output_limit;
    const float output = std::min(motion == Motion::Rotate ? config_.rotate_output : config_.move_output,
                                  output_limit_);
    target_speed_ = direction * output;
    if (changed) {
        left_boost_deadline_us_ = 0;
        right_boost_deadline_us_ = 0;
    }
    if (config_.ramp_time_ms == 0) {
        advanceLocked(0);
    } else if (changed) {
        writeMotorsLocked();
    }
    xTaskNotifyGive(task_);
}

void Chassis::forward(float output_limit) {
    setMotion(Motion::Move, 1, output_limit);
}

void Chassis::backward() {
    setMotion(Motion::Move, -1);
}

void Chassis::turnLeft(float output_limit) {
    setMotion(Motion::Rotate, 1, output_limit);
}

void Chassis::turnRight(float output_limit) {
    setMotion(Motion::Rotate, -1, output_limit);
}

void Chassis::stop() {
    setMotion(Motion::Stopped, 0);
}

void Chassis::emergencyStop() {
    std::lock_guard<std::mutex> lock(mutex_);
    requested_ = Motion::Stopped;
    active_ = Motion::Stopped;
    output_limit_ = 1.0f;
    target_speed_ = 0;
    current_speed_ = 0;
    left_boost_deadline_us_ = 0;
    right_boost_deadline_us_ = 0;
    writeMotorsLocked();
}

void Chassis::taskEntry(void* arg) {
    static_cast<Chassis*>(arg)->run();
    vTaskDelete(nullptr);
}

void Chassis::run() {
    int64_t last_update = esp_timer_get_time();
    while (true) {
        ulTaskNotifyTake(pdTRUE, kUpdateTicks);
        const int64_t now = esp_timer_get_time();
        std::lock_guard<std::mutex> lock(mutex_);
        if (!running_) {
            break;
        }
        advanceLocked(std::max<int64_t>(0, now - last_update) / 1000000.0f);
        last_update = now;
    }
    xSemaphoreGive(task_stopped_);
}

void Chassis::advanceLocked(float elapsed_seconds) {
    const float step = config_.ramp_time_ms == 0
                           ? 2.0f : elapsed_seconds * 1000.0f / config_.ramp_time_ms;
    if (current_speed_ == 0) {
        applied_left_scale_ = config_.left_scale;
        applied_right_scale_ = config_.right_scale;
    } else {
        applied_left_scale_ = approach(applied_left_scale_, config_.left_scale, step);
        applied_right_scale_ = approach(applied_right_scale_, config_.right_scale, step);
    }

    if (active_ != requested_) {
        current_speed_ = approach(current_speed_, 0, step);
        if (current_speed_ == 0) {
            active_ = requested_;
            if (config_.ramp_time_ms == 0) {
                current_speed_ = target_speed_;
            }
        }
    } else if (current_speed_ * target_speed_ < 0) {
        current_speed_ = approach(current_speed_, 0, step);
        if (current_speed_ == 0 && config_.ramp_time_ms == 0) {
            current_speed_ = target_speed_;
        }
    } else {
        current_speed_ = approach(current_speed_, target_speed_, step);
    }
    writeMotorsLocked();
}

void Chassis::writeMotorsLocked() {
    const float motion_max = std::min(active_ == Motion::Rotate ? config_.rotate_output : config_.move_output,
                                      output_limit_);
    const float left_speed = current_speed_ * (active_ == Motion::Rotate ? -1.0f : 1.0f);
    const bool moving_toward_target = active_ == requested_ && current_speed_ * target_speed_ > 0;
    const int64_t now_us = esp_timer_get_time();
    const float left_normal = applyMinOutput(left_speed, applied_left_scale_, motion_max, config_.min_output);
    const float right_normal = applyMinOutput(current_speed_, applied_right_scale_, motion_max, config_.min_output);
    const float left = applyStartBoost(left_normal, last_left_output_, config_.start_boost_output, now_us,
                                       left_boost_deadline_us_, moving_toward_target);
    const float right = applyStartBoost(right_normal, last_right_output_, config_.start_boost_output, now_us,
                                        right_boost_deadline_us_, moving_toward_target);
    if (left != last_left_output_) {
        left_.setSpeed(left);
        last_left_output_ = left;
    }
    if (right != last_right_output_) {
        right_.setSpeed(right);
        last_right_output_ = right;
    }
}
