import { catalog } from "./catalog.ts";
import type { Module, Connection, ModuleType } from "./catalog.ts";
import { electricalReport, nets, resolvePin, endpoint } from "./electrical.ts";

function validateDesign(value: unknown): { nodes: Module[]; connections: Connection[] } {
  if (!value || typeof value !== "object") throw Error("设计必须是对象");
  const { nodes, connections } = value as { nodes: unknown; connections: unknown };
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > 20 || !Array.isArray(connections) || connections.length > 200)
    throw Error("设计需要 1–20 个模块、最多 200 根连接");
  const ids = new Set<number>();
  for (const n of nodes) {
    if (!n || !Number.isSafeInteger(n.id) || n.id < 1 || ids.has(n.id) || !catalog.some((p) => p.type === n.type))
      throw Error("模块型号或 ID 无效、重复");
    ids.add(n.id);
  }
  const wireIds = new Set<string>(), pairs = new Set<string>();
  const validEndpoint = (key: string) => {
    const port = resolvePin(nodes, key);
    return port && key === endpoint(port.node.id, port.pin.id);
  };
  for (const c of connections) {
    if (!c || typeof c.id !== "string" || !c.id || c.id.length > 160 || wireIds.has(c.id) ||
        typeof c.a !== "string" || typeof c.b !== "string" || c.a === c.b ||
        !validEndpoint(c.a) || !validEndpoint(c.b)) throw Error("连接 ID 或端点无效、重复");
    const pair = [c.a, c.b].sort().join("|");
    if (pairs.has(pair)) throw Error("端点重复连接");
    pairs.add(pair); wireIds.add(c.id);
  }
  return { nodes: nodes.map((n) => ({ id: n.id, type: n.type, x: 0, y: 0 })),
    connections: connections.map((c) => ({ id: c.id, a: c.a, b: c.b })) };
}

export function firmwareProject(value: unknown) {
  const design = validateDesign(value), { nodes, connections } = design;
  const report = electricalReport(nodes, connections);
  if (report.issues.length) throw Error(`电气检查未通过：${report.issues.join("；")}`);
  const groups = nets(nodes, connections);
  const group = (id: number, pin: string) => groups.find((g) => g.includes(endpoint(id, pin)))!;
  const gpio = (id: number, pin: string) => {
    const port = group(id, pin).map((key) => resolvePin(nodes, key)!).find((p) => p.node.type === "esp" && p.pin.kind === "gpio");
    if (!port) throw Error(`模块 #${id} ${pin} 缺少可用 GPIO`);
    return Number(port.pin.name.slice(4));
  };
  const device = (type: ModuleType) => nodes.find((n) => n.type === type);
  const o = device("oled"), m = device("mic"), a = device("speaker"), d = device("motor");
  const oled = o ? { id: o.id, sda: gpio(o.id, "SDA"), scl: gpio(o.id, "SCL"), reset: gpio(o.id, "RST"), width: 128, height: 32, address: 60 } : null;
  const mic = m ? { id: m.id, bclk: gpio(m.id, "BCLK"), ws: gpio(m.id, "WS"), data: gpio(m.id, "DOUT"), channel: report.audio.microphones[0].channel === "left" ? 0 : 1 } : null;
  const amp = a ? { id: a.id, bclk: gpio(a.id, "BCLK"), ws: gpio(a.id, "LRC"), data: gpio(a.id, "DIN") } : null;
  // shortcut: esp32sim RX supports independent master clocks; enable duplex when its slave clock model is available.
  if (mic && amp && (mic.bclk === amp.bclk || mic.ws === amp.ws)) throw Error("当前 esp32sim 不支持共用 I²S 时钟，请为麦克风和功放分配独立 BCLK / WS GPIO");
  if (mic && amp && mic.data === amp.data) throw Error("麦克风输出与功放输入需要独立 GPIO，避免主控与麦克风争用数据线");
  const motor = d ? { id: d.id, enable: gpio(d.id, "SLP"), pins: ["AIN1", "AIN2", "BIN1", "BIN2"].map((p) => gpio(d.id, p)),
    loads: ["A", "B"].map((channel) => {
      const load = group(d.id, `${channel}OUT1`).map((key) => resolvePin(nodes, key)!).find((p) => p.node.type === "dcMotor")!;
      return { id: load.node.id, polarity: load.pin.id === "M1" ? 1 : -1 };
    }) } : null;
  const spec = { version: 1, oled, mic, amp, motor };
  const definitions: Record<string, number> = {
    HAS_OLED: +!!oled, OLED_SDA: oled?.sda ?? -1, OLED_SCL: oled?.scl ?? -1, OLED_RST: oled?.reset ?? -1,
    HAS_MIC: +!!mic, MIC_BCLK: mic?.bclk ?? -1, MIC_WS: mic?.ws ?? -1, MIC_DATA: mic?.data ?? -1, MIC_CHANNEL: mic?.channel ?? 0,
    HAS_AMP: +!!amp, AMP_BCLK: amp?.bclk ?? -1, AMP_WS: amp?.ws ?? -1, AMP_DATA: amp?.data ?? -1,
    HAS_MOTOR: +!!motor, MOTOR_ENABLE: motor?.enable ?? -1,
    ...Object.fromEntries(["A1", "A2", "B1", "B2"].map((name, i) => [`MOTOR_${name}`, motor?.pins[i] ?? -1])),
  };
  return { design, spec, report, header: "// Generated from the validated wiring. ESP-IDF 6.0.1 / ESP32-S3.\n#pragma once\n" +
    Object.entries(definitions).map(([key, value]) => `#define ${key} ${value}`).join("\n") + "\n" };
}
