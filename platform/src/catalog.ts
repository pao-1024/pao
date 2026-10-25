export type ModuleType = "esp" | "oled" | "mic" | "speaker" | "motor";
export type Part = {
  type: ModuleType;
  name: string;
  model: string;
  maker: string;
  category: string;
  image: string;
  voltage: string;
  bus: string;
  source: string;
  note: string;
};
export const catalog: Part[] = [
  {
    type: "esp",
    name: "ESP32-S3 DevKitC-1",
    model: "ESP32-S3-WROOM-1 · 44 pins",
    maker: "Espressif",
    category: "主控",
    image: "esp.png",
    voltage: "3.3 V 逻辑",
    bus: "GPIO / I²C / I²S",
    source:
      "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html",
    note: "44 针 J1 / J3；启动、USB、PSRAM 与板载资源相关引脚按当前板型保留。USB 与外部电源不能同时供电。",
  },
  {
    type: "oled",
    name: "OLED 显示模块",
    model: "Adafruit #931 · SSD1306 · 128 × 32",
    maker: "Adafruit",
    category: "显示",
    image: "oled.svg",
    voltage: "VIN 3.3–5 V",
    bus: "I²C",
    source:
      "https://learn.adafruit.com/monochrome-oled-breakouts/wiring-128x32-i2c-display",
    note: "六针版本，不是 PAO 的四针 128×64 OLED。3V3 为板载稳压输出，尚未开放接线；RST 按驱动要求处理。端子面板不是物理针序。",
  },
  {
    type: "mic",
    name: "I²S 麦克风",
    model: "Adafruit #3421 · SPH0645",
    maker: "Adafruit",
    category: "音频",
    image: "mic.svg",
    voltage: "3.3 V",
    bus: "I²S 输入",
    source:
      "https://learn.adafruit.com/adafruit-i2s-mems-microphone-breakout/pinouts",
    note: "SEL 接地选择左声道。SPH0645 不是 PAO 的 INMP441，固件驱动与采样时序需要单独验证。",
  },
  {
    type: "speaker",
    name: "I²S 数字功放",
    model: "Adafruit #3006 · MAX98357A",
    maker: "Adafruit",
    category: "音频",
    image: "amp.svg",
    voltage: "VIN 2.5–5.5 V",
    bus: "I²S 输出",
    source:
      "https://learn.adafruit.com/adafruit-max98357-i2s-class-d-mono-amp/pinouts",
    note: "LRC 对应 LRCLK；OUT_PLUS / OUT_MINUS 对应板上 + / −。差分输出只能接匹配扬声器，两端都不能接地。",
  },
  {
    type: "motor",
    name: "双路电机驱动",
    model: "Adafruit #3297 · DRV8833",
    maker: "Adafruit",
    category: "执行器",
    image: "motor.svg",
    voltage: "VMOTOR 2.7–10.8 V",
    bus: "PWM",
    source:
      "https://learn.adafruit.com/adafruit-drv8833-dc-stepper-motor-driver-breakout-board/pinouts",
    note: "默认休眠，SLP 需要有效高电平。当前只开放电源、控制和负载端子；VM、ASEN、BSEN 未开放。不是 PAO 的 MX1508，不能直接复用其固件。",
  },
];
export const partFor = (type: ModuleType) =>
  catalog.find((p) => p.type === type)!;
export type Point = { x: number; y: number };
export type Module = {
  id: number;
  type: ModuleType;
  x: number;
  y: number;
  placement?: Point;
};
export type Connection = { id: string; a: string; b: string };
export type Trace = {
  connection: string;
  layer: "F.Cu" | "B.Cu";
  width: number;
  points: Point[];
};
export const starter: Module[] = [
  { id: 1, type: "esp", x: 70, y: 80 },
  { id: 2, type: "oled", x: 510, y: 65 },
  { id: 3, type: "mic", x: 850, y: 350 },
  { id: 4, type: "speaker", x: 510, y: 400 },
];
