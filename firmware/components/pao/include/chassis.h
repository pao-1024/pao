#pragma once

#include <mutex>

class Motor;

class Chassis {
public:
    // 左右电机必须是不同实例，且生命周期覆盖底盘；两轮均以前进为正方向。
    // 构造和析构时停止两轮。
    Chassis(Motor& left, Motor& right);
    ~Chassis();

    Chassis(const Chassis&) = delete;
    Chassis& operator=(const Chassis&) = delete;

    // forward、turn ∈ [-1, 1]，分别表示前进和向左旋转的控制量。
    // drive(0, 0) 滑行停止；有限越界值限幅，任一非有限值使两轮停止。
    // 不能在 ISR 中调用。
    void drive(float forward, float turn);

private:
    Motor& left_;
    Motor& right_;
    std::mutex mutex_;
};
