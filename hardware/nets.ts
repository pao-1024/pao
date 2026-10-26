function net(name: string) {
  return { name, selector: `net.${name}` } as const
}

// 功能区之间的共享网络；标签与接线选择器从同一个名称生成。
export const nets = {
  power: {
    v5: net("V5"),
    v3v3: net("V3V3"),
    // 由 5V 单独降压得到，只供继电器线圈与发射器，不接入主控 3V3。
    v3v3Aux: net("V3V3_AUX"),
    gnd: net("GND"),
  },
  microphone: {
    ws: net("MIC_WS"),
    sck: net("MIC_SCK"),
    sd: net("MIC_SD"),
  },
  audioOutput: {
    din: net("AMP_DIN"),
    bclk: net("AMP_BCLK"),
    lrc: net("AMP_LRC"),
  },
  display: {
    sda: net("OLED_SDA"),
    scl: net("OLED_SCL"),
  },
  ultrasonic: {
    trig: net("ULTRASONIC_TRIG"),
    echo: net("ULTRASONIC_ECHO"),
  },
  motorDrive: {
    in1: net("MOTOR_IN1"),
    in2: net("MOTOR_IN2"),
    in3: net("MOTOR_IN3"),
    in4: net("MOTOR_IN4"),
  },
  // 开发板自带的按键与状态灯，只在主控引脚上标注，不接外部器件。
  onboard: {
    boot: net("ONBOARD_BOOT"),
    led: net("ONBOARD_LED"),
  },
  launcher: {
    fire: net("LAUNCH_FIRE"),
  },
} as const
