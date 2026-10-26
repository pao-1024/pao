#include "forward_distance_mover.h"

#include "chassis.h"
#include "hc_sr04.h"

namespace {
constexpr float kMinimumDistanceCm = 10.0f;
}

ForwardDistanceMover::ForwardDistanceMover(HcSr04& ultrasonic, Chassis& chassis)
    : ultrasonic_(ultrasonic), chassis_(chassis) {}

esp_err_t ForwardDistanceMover::readDistanceCm(float& distance_cm) {
    return ultrasonic_.readDistanceCm(distance_cm);
}

bool ForwardDistanceMover::forwardCm(int distance_cm, float initial_cm) {
    if (initial_cm - distance_cm < kMinimumDistanceCm) {
        status_.motion_status = "obstacle";
        return false;
    }
    start_distance_cm_ = initial_cm;
    goal_ = Goal::ForwardAmount;
    status_.requested_cm = distance_cm;
    status_.moved_cm = 0;
    status_.active = true;
    status_.motion_status = "moving";
    chassis_.forward();
    return true;
}

bool ForwardDistanceMover::forwardToDistanceCm(int distance_cm, float initial_cm) {
    status_.requested_cm = distance_cm;
    status_.moved_cm = 0;
    if (distance_cm < kMinimumDistanceCm) {
        status_.motion_status = "obstacle";
        return false;
    }
    if (initial_cm <= distance_cm) {
        status_.motion_status = "reached";
        return false;
    }
    start_distance_cm_ = initial_cm;
    target_distance_cm_ = distance_cm;
    goal_ = Goal::ObstacleDistance;
    status_.active = true;
    status_.motion_status = "moving";
    chassis_.forward();
    return true;
}

void ForwardDistanceMover::update(esp_err_t error, float current_cm) {
    if (!status_.active) {
        return;
    }
    bool finished = true;
    if (error != ESP_OK) {
        status_.motion_status = "sensor_error";
    } else {
        status_.moved_cm = start_distance_cm_ - current_cm;
        if (goal_ == Goal::ForwardAmount) {
            if (status_.moved_cm >= status_.requested_cm) {
                status_.motion_status = "reached";
            } else if (current_cm <= kMinimumDistanceCm) {
                status_.motion_status = "obstacle";
            } else {
                finished = false;
            }
        } else if (current_cm <= kMinimumDistanceCm && target_distance_cm_ > kMinimumDistanceCm) {
            status_.motion_status = "obstacle";
        } else if (current_cm <= target_distance_cm_) {
            status_.motion_status = "reached";
        } else {
            finished = false;
        }
    }
    if (finished) {
        status_.active = false;
        chassis_.emergencyStop();
    }
}

void ForwardDistanceMover::cancel(const char* status) {
    status_.active = false;
    status_.motion_status = status;
}

ForwardDistanceStatus ForwardDistanceMover::status() const {
    return status_;
}
