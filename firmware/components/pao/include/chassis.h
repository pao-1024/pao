#pragma once

#include <mutex>

class Motor;

struct ChassisConfig {
    float left_scale = 1.0f;
    float right_scale = 1.0f;
    float move_output = 0.8f;
    float rotate_output = 0.8f;
};

class Chassis {
public:
    // 左右电机必须是不同实例，生命周期覆盖底盘；两轮均以前进为正方向。
    Chassis(Motor& left, Motor& right);
    ~Chassis();

    Chassis(const Chassis&) = delete;
    Chassis& operator=(const Chassis&) = delete;

    // 四个方向使用配置中的最大输出；不能在 ISR 中调用。
    void forward();
    void backward();
    void turnLeft();
    void turnRight();
    // 立即清零两轮输出。
    void stop();
    // 与 stop() 相同，保留立即停止接口。
    void emergencyStop();

    // 修改配置不会重置当前运动；无效配置保持原值。
    bool setConfig(const ChassisConfig& config);
    ChassisConfig config() const;
    static bool validConfig(const ChassisConfig& config);

private:
    enum class Motion { Stopped, Move, Rotate };

    void setMotion(Motion motion, int direction);
    void writeMotorsLocked();

    Motor& left_;
    Motor& right_;
    mutable std::mutex mutex_;
    ChassisConfig config_;
    Motion motion_ = Motion::Stopped;
    int direction_ = 0;
    float last_left_output_ = 0;
    float last_right_output_ = 0;
};
