#pragma once

#include <driver/gpio.h>

// Same I2S and BOOT pins as upstream bread-compact-wifi.
#define AUDIO_INPUT_SAMPLE_RATE 16000
#define AUDIO_OUTPUT_SAMPLE_RATE 24000
#define AUDIO_I2S_MIC_GPIO_WS GPIO_NUM_4
#define AUDIO_I2S_MIC_GPIO_SCK GPIO_NUM_5
#define AUDIO_I2S_MIC_GPIO_DIN GPIO_NUM_6
#define AUDIO_I2S_SPK_GPIO_DOUT GPIO_NUM_7
#define AUDIO_I2S_SPK_GPIO_BCLK GPIO_NUM_15
#define AUDIO_I2S_SPK_GPIO_LRCK GPIO_NUM_16
#define BOOT_BUTTON_GPIO GPIO_NUM_0
#define BUILTIN_LED_GPIO GPIO_NUM_48

// MX1508: IN1/IN2 drive the right motor, IN3/IN4 drive the left motor.
#define MOTOR_GPIO_IN1 GPIO_NUM_11
#define MOTOR_GPIO_IN2 GPIO_NUM_12
#define MOTOR_GPIO_IN3 GPIO_NUM_13
#define MOTOR_GPIO_IN4 GPIO_NUM_14

// 两块 3.3V 单路继电器模块：CH1 给发射器供电（通电即充能），CH2 短接发射按钮。
// 触发跳帽均设在 L 档，低电平吸合，线圈由 5V 降压得到的专用 3.3V 供电。
#define LAUNCHER_GPIO_CHARGE GPIO_NUM_17
#define LAUNCHER_GPIO_FIRE GPIO_NUM_18
