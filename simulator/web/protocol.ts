// PAO wiring (firmware/boards/pao/config.h) and decoders for what the simulator reports on it.
export type Bus = "i2c" | "i2s" | "pwm" | "gpio" | "uart";
/** `out`: driven by the ESP32-S3; `in`: driven by the module. */
export type Wire = { pin: number; signal: string; bus: Bus; dir: "out" | "in" };
export type Module = { id: string; name: string; part: string; side: "left" | "right"; wires: Wire[] };

const wire = (pin: number, signal: string, bus: Bus, dir: "out" | "in" = "out"): Wire => ({ pin, signal, bus, dir });

export const MODULES: Module[] = [
  { id: "mic", name: "麦克风", part: "INMP441 · I2S1", side: "left",
    wires: [wire(4, "WS", "i2s"), wire(5, "SCK", "i2s"), wire(6, "SD", "i2s", "in")] },
  { id: "amp", name: "功放", part: "MAX98357A · I2S0", side: "left",
    wires: [wire(7, "DIN", "i2s"), wire(15, "BCLK", "i2s"), wire(16, "LRC", "i2s")] },
  { id: "oled", name: "OLED", part: "SSD1306 · 0x3C", side: "left",
    wires: [wire(41, "SDA", "i2c"), wire(42, "SCL", "i2c")] },
  { id: "boot", name: "BOOT 按键", part: "低电平按下", side: "left", wires: [wire(0, "KEY", "gpio", "in")] },
  { id: "uart", name: "串口", part: "UART0 → 主机日志", side: "left", wires: [wire(43, "TX", "uart")] },
  { id: "motor-r", name: "右电机", part: "MX1508 A 路", side: "right",
    wires: [wire(11, "IN1", "pwm"), wire(12, "IN2", "pwm")] },
  { id: "motor-l", name: "左电机", part: "MX1508 B 路", side: "right",
    wires: [wire(13, "IN3", "pwm"), wire(14, "IN4", "pwm")] },
  { id: "relay", name: "继电器", part: "发射按钮 · 低电平吸合", side: "right", wires: [wire(18, "IN", "gpio")] },
  { id: "led", name: "状态灯", part: "GPIO48 指示", side: "right", wires: [wire(48, "DIN", "gpio")] },
  { id: "ultrasonic", name: "超声波", part: "HC-SR04 · 前方边界", side: "right",
    wires: [wire(8, "Trig", "gpio"), wire(9, "Echo", "gpio", "in")] },
];

export const PIN_LABEL = new Map(MODULES.flatMap(m => m.wires.map(w => [w.pin, `${m.name} ${w.signal}`] as const)));
export const RELAY_PINS = new Set([18]);
export const hex2 = (byte: number) => byte.toString(16).padStart(2, "0").toUpperCase();

// SSD1306 Rev 1.1 section 10: [name, parameter bytes].
const COMMANDS: Record<number, [string, number]> = {
  0x20: ["寻址模式", 1], 0x21: ["列地址", 2], 0x22: ["页地址", 2], 0x81: ["对比度", 1],
  0x8d: ["电荷泵", 1], 0xa8: ["复用比", 1], 0xd3: ["显示偏移", 1], 0xd5: ["时钟分频", 1],
  0xd9: ["预充电周期", 1], 0xda: ["COM 引脚配置", 1], 0xdb: ["VCOMH 电平", 1],
  0xa0: ["段重映射 关", 0], 0xa1: ["段重映射 开", 0], 0xa4: ["按显存显示", 0], 0xa5: ["全屏点亮", 0],
  0xa6: ["正常显示", 0], 0xa7: ["反色显示", 0], 0xae: ["显示关", 0], 0xaf: ["显示开", 0],
  0xc0: ["COM 正向扫描", 0], 0xc8: ["COM 反向扫描", 0], 0xe3: ["空操作", 0],
};

function commandName(op: number): [string, number] {
  if (op <= 0x0f) return [`列低位 ${op & 15}`, 0];
  if (op <= 0x1f) return [`列高位 ${op & 7}`, 0];
  if (op >= 0x40 && op <= 0x7f) return [`起始行 ${op & 63}`, 0];
  if (op >= 0xb0 && op <= 0xb7) return [`页 ${op & 7}`, 0];
  return COMMANDS[op] ?? ["未知命令", 0];
}

/** One I2C write to the SSD1306 as text: decoded commands, then the count of display RAM bytes. */
export function decodeSsd1306(bytes: number[], len: number): string {
  const parts: string[] = [];
  let data = 0, i = 0, dataStream = false;
  let pending: { op: number; name: string; need: number; params: number[] } | null = null;
  const command = (byte: number) => {
    if (pending) {
      pending.params.push(byte);
      if (pending.params.length < pending.need) return;
      const { op, name, params } = pending;
      const value = op === 0x21 || op === 0x22 ? `${params[0]}–${params[1]}` : params.map(hex2).join(" ");
      parts.push(`${hex2(op)} ${name} ${value}`);
      pending = null;
      return;
    }
    const [name, need] = commandName(byte);
    if (need) pending = { op: byte, name, need, params: [] };
    else parts.push(`${hex2(byte)} ${name}`);
  };
  while (i < bytes.length) {
    const control = bytes[i++];
    const single = (control & 0x80) !== 0;
    dataStream = (control & 0x40) !== 0 && !single;
    const end = single ? Math.min(i + 1, bytes.length) : bytes.length;
    for (; i < end; i++) {
      if (control & 0x40) data++; else command(bytes[i]);
    }
  }
  const missing = len - bytes.length;
  if (missing > 0) {
    if (dataStream) data += missing; else parts.push(`… 另有 ${missing} 字节`);
  }
  if (data) parts.push(`显存写入 ${data} 字节`);
  return parts.join(" · ") || "空事务";
}

/** Signed wheel speeds in [-1, 1] from the MX1508 inputs (motor.cc drives one input per direction). */
export function wheels(pwm: Map<number, number>, high: (pin: number) => boolean) {
  const duty = (pin: number) => (pwm.get(pin) ?? (high(pin) ? 1000 : 0)) / 1000;
  // pao_board.cc creates the left motor as (IN4, IN3) so positive speed is forward on both sides.
  return { right: duty(11) - duty(12), left: duty(14) - duty(13) };
}

export function motion(left: number, right: number) {
  const forward = (left + right) / 2, turn = (right - left) / 2;
  if (Math.abs(left) < 0.01 && Math.abs(right) < 0.01) return "停止";
  if (Math.abs(forward) < 0.02) return turn > 0 ? "原地左转" : "原地右转";
  const direction = forward > 0 ? "前进" : "后退";
  if (Math.abs(turn) < 0.02) return direction;
  return `${direction}并${turn > 0 ? "左" : "右"}转`;
}

/** Heading 0 faces +Z and grows turning left. */
export type Pose = { x: number; z: number; heading: number };
/** Native world coordinates and geometry are in centimetres, heading in radians. */
export type World = Pose & { distance_cm: number; width_cm: number; depth_cm: number };
// Decorative wheel spin only; the native world owns car position and distance.
export const MAX_SPEED = 3;

/** Simulated launcher energy: the module is always powered and charging; a relay (GPIO18) pull-in spends it. */
export type Launcher = { energy: number; shots: number; lastShot: number | null };
// Simulation-only linear charge; replace the assumed timing with measurements from the real module.
export const FULL_CHARGE_S = 10;

/** Advances the launcher by `dt` seconds of charging, then applies a pull-in seen in the same interval. */
export function stepLauncher(state: Launcher, dt: number, fired: boolean): Launcher {
  const energy = Math.min(1, state.energy + dt / FULL_CHARGE_S);
  return fired ? { energy: 0, shots: state.shots + 1, lastShot: energy } : { ...state, energy };
}

const STATES: Record<string, string> = {
  starting: "启动中", wifi_configuring: "配网", idle: "待机", connecting: "连接中", listening: "聆听",
  speaking: "说话", upgrading: "升级", activating: "激活中", audio_testing: "音频测试", fatal_error: "错误",
};
export const stateLabel = (state: string) => STATES[state] ?? state;
