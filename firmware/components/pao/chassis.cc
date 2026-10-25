#include "chassis.h"

#include <algorithm>
#include <cmath>

#include "esp_err.h"
#include "esp_timer.h"
#include "motor.h"

namespace {
constexpr TickType_t kUpdateTicks = pdMS_TO_TICKS(20);

float approach(float current, float target, float step) {
    return current + std::clamp(target - current, -step, step);
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
           config.left_scale <= 1 && config.right_scale >= 0 && config.right_scale <= 1;
}

bool Chassis::setConfig(const ChassisConfig& config) {
    if (!validConfig(config)) {
        return false;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    config_ = config;
    if (config_.ramp_time_ms == 0) {
        advanceLocked(0);
    }
    xTaskNotifyGive(task_);
    return true;
}

ChassisConfig Chassis::config() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return config_;
}

void Chassis::setMotion(Motion motion, float speed) {
    if (!std::isfinite(speed)) {
        speed = 0;
    }
    std::lock_guard<std::mutex> lock(mutex_);
    requested_ = motion;
    target_speed_ = std::clamp(speed, -1.0f, 1.0f);
    if (config_.ramp_time_ms == 0) {
        advanceLocked(0);
    }
    xTaskNotifyGive(task_);
}

void Chassis::forward(float output) {
    setMotion(Motion::Move, std::max(0.0f, output));
}

void Chassis::backward(float output) {
    setMotion(Motion::Move, -std::max(0.0f, output));
}

void Chassis::turnLeft(float output) {
    setMotion(Motion::Rotate, std::max(0.0f, output));
}

void Chassis::turnRight(float output) {
    setMotion(Motion::Rotate, -std::max(0.0f, output));
}

void Chassis::stop() {
    setMotion(Motion::Stopped, 0);
}

void Chassis::emergencyStop() {
    std::lock_guard<std::mutex> lock(mutex_);
    requested_ = Motion::Stopped;
    active_ = Motion::Stopped;
    target_speed_ = 0;
    current_speed_ = 0;
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
    const float left = current_speed_ * applied_left_scale_ *
                       (active_ == Motion::Rotate ? -1.0f : 1.0f);
    const float right = current_speed_ * applied_right_scale_;
    if (left != last_left_output_) {
        left_.setSpeed(left);
        last_left_output_ = left;
    }
    if (right != last_right_output_) {
        right_.setSpeed(right);
        last_right_output_ = right;
    }
}
