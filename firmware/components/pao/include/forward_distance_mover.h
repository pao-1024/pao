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

// 使用前向超声波控制向前运动：可走指定距离，也可停在距障碍物的目标距离。
// 状态方法由调用方串行化；测距应在锁外进行，避免阻塞急停。
class ForwardDistanceMover {
public:
    ForwardDistanceMover(HcSr04& ultrasonic, Chassis& chassis);

    esp_err_t readDistanceCm(float& distance_cm);
    // 前者走指定距离，后者停在距前方反射物的指定距离。
    bool forwardCm(int distance_cm, float initial_cm);
    bool forwardToDistanceCm(int distance_cm, float initial_cm);
    void update(esp_err_t error, float current_cm);
    void cancel(const char* status);
    ForwardDistanceStatus status() const;

private:
    enum class Goal { ForwardAmount, ObstacleDistance };

    HcSr04& ultrasonic_;
    Chassis& chassis_;
    ForwardDistanceStatus status_;
    Goal goal_ = Goal::ForwardAmount;
    float start_distance_cm_ = 0;
    float target_distance_cm_ = 0;
};
