export type ModuleType = "esp" | "oled" | "mic" | "speaker" | "motor" | "supply" | "speakerLoad" | "dcMotor";
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
  load?: { family: "audio"; ohms: number; watts: number } | { family: "motor"; ratedVolts: number; stallMa: number };
  output?: { family: "audio"; minOhms: number; maxWatts: number } | { family: "motor"; channelMa: number };
};
export const catalog: Part[] = [
  {
    type: "esp",
    name: "ESP32-S3 DevKitC-1",
    model: "DevKitC-1 v1.1 · ESP32-S3-WROOM-1 N8R8",
    maker: "Espressif",
    category: "主控",
    image: "esp.png",
    voltage: "3.3 V 逻辑",
    bus: "GPIO / I²C / I²S",
    source:
      "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html",
    note: "44 针 J1 / J3；GPIO38 为 v1.1 RGB LED，35–37 用于八线 PSRAM。本设计从 5V 排针供电，两个 USB 口均须断开供电；调试须使用隔离供电的数据连接。",
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
    note: "六针旧版 #931，含板载稳压、I²C 上拉及电平转换。VIN 默认接 3.3V，RST 接 GPIO17，由驱动执行复位；3V3 稳压输出不与其他电源并联。",
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
    output: { family: "audio", minOhms: 4, maxWatts: 3 },
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
    output: { family: "motor", channelMa: 1000 },
    name: "双路电机驱动",
    model: "Adafruit #3297 · DRV8833",
    maker: "Adafruit",
    category: "执行器",
    image: "motor.svg",
    voltage: "VMOTOR 2.7–10.8 V",
    bus: "PWM",
    source:
      "https://learn.adafruit.com/adafruit-drv8833-dc-stepper-motor-driver-breakout-board/pinouts",
    note: "VMOTOR 使用独立 5V 电源支路，SLP 接 GPIO18，上电保持低；固件初始化四路控制脚为低后才使能。每路默认限流 1A，负载选用 Pololu #992。FLT 为开漏输出，未使用时可不接。",
  },
  {
    type: "supply", name: "5V 外部电源", model: "Adafruit #1466 + #368 · 5V / 4A",
    maker: "Adafruit", category: "电源", image: "https://cdn-shop.adafruit.com/970x728/1466-10.jpg",
    voltage: "5V / 4A", bus: "直流供电",
    source: "https://www.adafruit.com/product/1466",
    note: "套件包含 #1466 电源和 #368 中心正极 2.1mm DC 转接端子，+ 接 5V，− 接 GND。主控、功放和电机分别回到电源，禁止叠加 USB 供电。",
  },
  {
    type: "speakerLoad", name: "4Ω 扬声器", model: "Adafruit #1314 · 4Ω / 3W",
    load: { family: "audio", ohms: 4, watts: 3 },
    maker: "Adafruit", category: "负载", image: "https://cdn-shop.adafruit.com/970x728/1314-07.jpg",
    voltage: "4Ω / 3W", bus: "BTL 差分负载",
    source: "https://www.adafruit.com/product/1314",
    note: "两端只接同一 MAX98357A 的 OUT+ / OUT−，任何一端均不可接地。5V 下按最高 3W 输出核对额定功率。",
  },
  {
    type: "dcMotor", name: "低功耗减速电机", model: "Pololu #992 · LP 6V · 100:1",
    load: { family: "motor", ratedVolts: 6, stallMa: 360 },
    maker: "Pololu", category: "负载", image: "https://a.pololu-files.com/picture/0J12477.600x480.jpg?4c91aeac1932e69a79d496bb79a41e6f",
    voltage: "额定 6V · 本设计 5V", bus: "H 桥双端负载",
    source: "https://www.pololu.com/product/992",
    note: "6V 理论堵转电流 0.36A；本设计在 5V 降压使用，仍按 0.36A 预留电流。每台只接 DRV8833 的同一路 A 或 B，不允许持续堵转。",
  },
];
export const partFor = (type: ModuleType) =>
  catalog.find((p) => p.type === type)!;
export const moduleImage = (type: ModuleType) => {
  const image = partFor(type).image;
  return image.startsWith("https://") ? image : `/modules/${image}`;
};
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
  vias?: Point[];
  from?: string;
  to?: string;
  automatic?: boolean;
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
  { id: 5, type: "supply", x: 70, y: 720 },
  { id: 6, type: "speakerLoad", x: 850, y: 720 },
];
export const defaultBoard = { width: 140, height: 100 };

export function completeProject(nodes: Module[]): Module[] {
  const result = [...nodes];
  let id = Math.max(0, ...nodes.map((n) => n.id));
  const add = (type: ModuleType) => result.push({ id: ++id, type,
    x: 70 + ((result.length % 4) * 340), y: 80 + Math.floor(result.length / 4) * 350 });
  if (nodes.some((n) => ["esp", "oled", "mic", "speaker", "motor"].includes(n.type)) && !nodes.some((n) => n.type === "supply")) add("supply");
  if (nodes.some((n) => n.type === "speaker") && !nodes.some((n) => n.type === "speakerLoad")) add("speakerLoad");
  if (nodes.some((n) => n.type === "motor"))
    for (let count = result.filter((n) => n.type === "dcMotor").length; count < 2; count++) add("dcMotor");
  return result;
}
