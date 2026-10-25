#pragma once

#include "esp_err.h"

class Chassis;
class HcSr04;

struct ForwardDistanceStatus {
    const char* motion_status = "idle";
    int requested_cm = 0;
    float moved_cm = 0;
    bool active = false;
};

// 使用前向超声波相对同一静止反射物的距离变化估算前进量。
// 状态方法由调用方串行化；测距应在锁外进行，避免阻塞急停。
class ForwardDistanceMover {
public:
    ForwardDistanceMover(HcSr04& ultrasonic, Chassis& chassis);

    esp_err_t readDistanceCm(float& distance_cm);
    bool forwardCm(int distance_cm, float output, float initial_cm);
    void update(esp_err_t error, float current_cm);
    void cancel(const char* status);
    ForwardDistanceStatus status() const;

private:
    HcSr04& ultrasonic_;
    Chassis& chassis_;
    ForwardDistanceStatus status_;
    float start_distance_cm_ = 0;
};
