import type { Module, ModuleType, Point } from "./catalog.ts";
import { sensorDefinitions, sensorTypes, isSensor } from "./sensors.ts";

export type Rect = Point & { width: number; height: number };
export type Pad = Point & { pin: string; diameter: number; drill: number };
export type Footprint = {
  name: string; source: string; body: Rect; pads: Pad[];
  holes: (Point & { drill: number })[]; keepouts: (Rect & { name: string })[]; assembly: string;
};
const pad = (pin: string, x: number, y: number, diameter = 1.8, drill = 1): Pad => ({ pin, x, y, diameter, drill });
const hole = (x: number, y: number) => ({ x, y, drill: 2.7 });
const eagle = (repo: string, sha: string, file: string) => `https://github.com/adafruit/${repo}/blob/${sha}/${encodeURIComponent(file)}.brd`;
const terminalSource = "https://github.com/KiCad/kicad-footprints/blob/7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd/TerminalBlock_Phoenix.pretty/TerminalBlock_Phoenix_MKDS-1%2C5-2-5.08_1x02_P5.08mm_Horizontal.kicad_mod";
const terminal = (pins: string[]): Footprint => ({
  name: "Phoenix MKDS 1,5/2-5,08 · 1715721", source: terminalSource,
  body: { x: 0, y: 0, width: 10.16, height: 9.8 },
  pads: pins.map((p, i) => pad(p, 2.54 + i * 5.08, 5.2, 2.6, 1.3)), holes: [], keepouts: [],
  assembly: "板上 Phoenix 1715721 端子，5.08mm 间距；外部设备使用导线接入，按装配图极性接线。",
});

// Top view, millimetres. Adafruit coordinates are transformed from the fixed Eagle revision (Y up) to Y down.
export const footprints: Record<ModuleType, Footprint> = {
  ...Object.fromEntries(sensorTypes.map((type): [typeof type, Footprint] => { const d = sensorDefinitions[type]; return [type, {
    name: d.model, source: d.cad, body: { x: 0, y: 0, width: d.width, height: d.height },
    pads: d.physicalPins.map((p,i) => pad(p,d.firstX+i*2.54,d.pinY)), holes: d.holes.map(([x,y]) => hole(x,y)), keepouts: [],
    assembly: "原版 THT 排针版本，按丝印方向插入母排针；M2.5 绝缘支柱，离板至少 8.5mm。STEMMA 线缆不安装，板上 VIN/Vdd 供电为 3.3V，地址脚和 SHT31 复位按接线图连接。",
  }]; })) as Record<typeof sensorTypes[number],Footprint>,
  esp: {
    name: "Espressif ESP32-S3-DevKitC-1 v1.1 / WROOM-1",
    source: "https://dl.espressif.com/dl/schematics/esp_idf/DXF_ESP32-S3-DevKitC-1_V1.1_20220429.pdf",
    body: { x: -1.27, y: -1.27, width: 25.4, height: 62.74 },
    pads: ["J1", "J3"].flatMap((j, side) => Array.from({ length: 22 }, (_, row) => pad(`${j}-${row + 1}`, side * 22.86, row * 2.54))),
    holes: [], keepouts: [
      { name: "WROOM-1 天线 / 板框开槽", x: 1.5, y: -9.27, width: 19.86, height: 8 },
      { name: "USB 插头操作空间", x: 2.54, y: 55, width: 17.78, height: 12 },
    ],
    assembly: "两条 1×22 / 2.54mm 母排针，排距 22.86mm，离板高度至少 8.5mm。J1-1 为 3V3。天线位于顶部开槽；只适用原厂 v1.1 WROOM-1，不能替换宽版克隆板。两个 USB 口禁止叠加供电。",
  },
  oled: {
    name: "Adafruit #931 / 原版六针 128×32 I2C",
    source: eagle("Adafruit-128x32-I2C-OLED-Breakout-PCB", "8bcc38f98dbe399188a83ac2f394942b9bbe6e80", "Adafruit OLED 128x32 Mono I2C"),
    body: { x: 0, y: 0, width: 34, height: 20.5 },
    pads: ["VIN", "3V3", "GND", "RST", "SCL", "SDA"].map((p, i) => pad(p, 23.35 - i * 2.54, 18.246)),
    holes: [hole(2, 2), hole(2, 18.5), hole(32, 2), hole(32, 18.5)], keepouts: [],
    assembly: "1×6 母排针，2.54mm；四个 M2.5 绝缘支柱，离板至少 8.5mm。六针旧版 #931，不兼容 STEMMA QT 版本。",
  },
  mic: {
    name: "Adafruit #3421 / SPH0645",
    source: eagle("Adafruit-I2S-Microphone-Breakout-PCB", "bb0dfa60919c5679f676e0af41958bece6294b05", "Adafruit I2S Mic SPK0415HM4H"),
    body: { x: 0, y: 0, width: 16.51, height: 12.7 },
    pads: ["VDD", "GND", "BCLK", "DOUT", "WS", "SEL"].map((p, i) => pad(p, 14.605 - i * 2.54, 10.16)),
    holes: [hole(2.54, 2.54), hole(13.97, 2.54)],
    keepouts: [{ name: "底部声孔 / 保持空气通道", x: 5.5, y: 3, width: 5.5, height: 4 }],
    assembly: "1×6 / 2.54mm 母排针与 M2.5 绝缘支柱，离板至少 8.5mm；不得封堵模块底部声孔。BCLK 是物理第 3 针，不能按逻辑列表顺序焊接。",
  },
  speaker: {
    name: "Adafruit #3006 / MAX98357A 单声道",
    source: eagle("Adafruit-MAX98357-I2S-Amp-Breakout", "c7cf21b4a83affb8bd0ee4fb8251d5b266d964ff", "Adafruit MAX98357 Breakout"),
    // Rotated 90 degrees counterclockwise from the Eagle top view: control header faces the ESP32.
    body: { x: 0, y: 0, width: 19.05, height: 17.78 },
    pads: [...["VIN", "GND", "SD_MODE", "GAIN", "DIN", "BCLK", "LRC"].map((p, i) => pad(p, 16.51, 1.27 + i * 2.54)),
      pad("OUT_MINUS", 3.556, 10.69), pad("OUT_PLUS", 3.556, 7.19)],
    holes: [hole(2.54, 2.54), hole(2.54, 15.24)], keepouts: [],
    assembly: "1×7 / 2.54mm 母排针、M2.5 绝缘支柱，离板至少 8.5mm。输出为 3.5mm 间距：模块不焊原配螺丝端子，改用两根绝缘直通焊接引线接载板对应孔；+ / − 均不接地。",
  },
  motor: {
    name: "Adafruit #3297 / DRV8833",
    source: eagle("Adafruit-DRV8833-Motor-Driver-Breakout-PCB", "dda79a86d6518d05a35091cb8b03b9c0d57d04e2", "Adafruit DRV8833"),
    // Clockwise rotation puts the input header above the outputs and external motor terminals.
    body: { x: 0, y: 0, width: 25.4, height: 17.78 },
    pads: [...["VMOTOR", "GND", "FLT", "BIN1", "BIN2", "SLP", "AIN2", "AIN1"].map((p, i) => pad(p, 21.59 - i * 2.54, 2.54)),
      pad("AOUT1", 6.35, 15.24), pad("AOUT2", 8.89, 15.24), pad("BOUT1", 13.97, 15.24), pad("BOUT2", 11.43, 15.24),
      pad("NC:ASEN", 16.51, 15.24), pad("NC:BSEN", 19.05, 15.24), pad("NC:VMIN", 21.59, 7.598), pad("NC:GND-IN", 21.59, 11.098)],
    holes: [hole(22.86, 15.24), hole(2.54, 15.24)], keepouts: [],
    assembly: "1×8 和三条 1×2 / 2.54mm 排针及 M2.5 绝缘支柱，离板至少 8.5mm。ASEN/BSEN 预留不接；VMIN 端子不安装，5V 由 VMOTOR 排针输入，绕过模块反接保护，严禁反接。",
  },
  supply: terminal(["+5V", "GND"]), speakerLoad: terminal(["PLUS", "MINUS"]), dcMotor: terminal(["M1", "M2"]),
};

export function placement(node: Module, index: number): Point {
  if (isSensor(node.type)) return node.placement || { x: 98 + (index % 2) * 38, y: 52 + Math.floor(index / 2) * 24 };
  return node.placement || {
    esp: { x: 50, y: 10 }, oled: { x: 98, y: 18 }, mic: { x: 8, y: 10 },
    speaker: { x: 8, y: 35 }, motor: { x: 8, y: 62 }, supply: { x: 8, y: 87 },
    speakerLoad: { x: 34, y: 50 }, dcMotor: { x: 36 + 32 * Math.max(0, index - 7), y: 87 },
  }[node.type];
}
export function placedFootprints(nodes: Module[]) {
  return nodes.map((n, i) => {
    const f = footprints[n.type], at = placement(n, i);
    const move = <T extends Point>(p: T): T => ({ ...p, x: p.x + at.x, y: p.y + at.y });
    return { ...f, id: n.id, type: n.type, body: move(f.body),
      pads: f.pads.map((p) => ({ ...move(p), key: `${n.id}:${p.pin}` })), holes: f.holes.map(move), keepouts: f.keepouts.map(move) };
  });
}
export function padPoint(nodes: Module[], key: string): Point {
  const [id, pin] = key.split(":");
  const node = nodes.find((n) => n.id === Number(id));
  const p = node && footprints[node.type].pads.find((p) => p.pin === pin);
  if (!node || !p) throw Error("未知焊盘端点");
  const at = placement(node, nodes.indexOf(node));
  return { x: at.x + p.x, y: at.y + p.y };
}

export function antennaSlots(nodes: Module[]) {
  return placedFootprints(nodes).filter((f) => f.type === "esp").map((f) => ({
    x: f.keepouts[0].x, y: 0, width: f.keepouts[0].width, height: f.keepouts[0].y + f.keepouts[0].height + 1,
  }));
}
export function boardOutline(nodes: Module[], board: { width: number; height: number }): Point[] {
  const slots = antennaSlots(nodes).sort((a, b) => a.x - b.x);
  return [{ x: 0, y: 0 }, ...slots.flatMap((r) => [
    { x: r.x, y: 0 }, { x: r.x, y: r.height }, { x: r.x + r.width, y: r.height }, { x: r.x + r.width, y: 0 },
  ]), { x: board.width, y: 0 }, { x: board.width, y: board.height }, { x: 0, y: board.height }, { x: 0, y: 0 }];
}
