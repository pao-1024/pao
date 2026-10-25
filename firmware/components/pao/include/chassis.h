#pragma once

#include <cstdint>
#include <mutex>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

class Motor;

struct ChassisConfig {
    uint32_t ramp_time_ms = 1000;
    float left_scale = 1.0f;
    float right_scale = 1.0f;
};

class Chassis {
public:
    // 左右电机必须是不同实例，生命周期覆盖底盘；两轮均以前进为正方向。
    Chassis(Motor& left, Motor& right);
    ~Chassis();

    Chassis(const Chassis&) = delete;
    Chassis& operator=(const Chassis&) = delete;

    // 输出为非负值，超过 1 时限幅；无效值按 0 处理。不能在 ISR 中调用。
    void forward(float output);
    void backward(float output);
    void turnLeft(float output);
    void turnRight(float output);
    // 按配置的渐变时间减速停车。
    void stop();
    // 立即清零两轮输出和当前运动目标。
    void emergencyStop();

    // 修改配置不会重置当前运动；无效配置保持原值。
    bool setConfig(const ChassisConfig& config);
    ChassisConfig config() const;
    static bool validConfig(const ChassisConfig& config);

private:
    enum class Motion { Stopped, Move, Rotate };

    static void taskEntry(void* arg);
    void run();
    void setMotion(Motion motion, float speed);
    void advanceLocked(float elapsed_seconds);
    void writeMotorsLocked();

    Motor& left_;
    Motor& right_;
    mutable std::mutex mutex_;
    ChassisConfig config_;
    Motion requested_ = Motion::Stopped;
    Motion active_ = Motion::Stopped;
    float target_speed_ = 0;
    float current_speed_ = 0;
    float applied_left_scale_ = 1;
    float applied_right_scale_ = 1;
    float last_left_output_ = 0;
    float last_right_output_ = 0;
    bool running_ = true;
    TaskHandle_t task_ = nullptr;
    SemaphoreHandle_t task_stopped_ = nullptr;
};
