import { catalog } from "./catalog.ts";
import type { Module, Connection, ModuleType } from "./catalog.ts";
import { electricalReport, nets, resolvePin, endpoint } from "./electrical.ts";
import { validateAgent, type AgentApplication } from "./agent-spec.ts";

export type Application = { kind: "diagnostic" } | { kind: "intercom"; volume: number } |
  { kind: "sound-alarm"; threshold: number; holdMs: number; frequency: number } | AgentApplication;
export function defaultApplication(nodes: Module[]): Application {
  return nodes.some((n) => n.type === "mic") && nodes.some((n) => n.type === "speaker") ? { kind: "intercom", volume: 50 } : { kind: "diagnostic" };
}
function applicationConfig(value: unknown, nodes: Module[]): Application {
  if (value === undefined) return defaultApplication(nodes);
  if (!value || typeof value !== "object") throw Error("业务应用配置无效");
  const app = value as Record<string, unknown>;
  if (app.kind === "agent") return validateAgent(app);
  const number = (key: string, min: number, max: number) => {
    const n = app[key];
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) throw Error(`${key} 必须是 ${min}–${max} 范围内的整数`);
    return n;
  };
  if (app.kind === "diagnostic") return { kind: "diagnostic" };
  if (!["intercom", "sound-alarm"].includes(String(app.kind))) throw Error("未知业务应用类型");
  if (!nodes.some((n) => n.type === "mic") || !nodes.some((n) => n.type === "speaker")) throw Error("对讲和声音告警需要麦克风、功放及匹配负载");
  return app.kind === "intercom" ? { kind: "intercom", volume: number("volume", 0, 100) } :
    { kind: "sound-alarm", threshold: number("threshold", 100, 30000), holdMs: number("holdMs", 100, 10000), frequency: number("frequency", 100, 2000) };
}

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
  const graph = validateDesign(value), { nodes, connections } = graph;
  const application = applicationConfig((value as { application?: unknown }).application, nodes);
  const design = { ...graph, application };
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
  const sharedI2s = !!(mic && amp && mic.bclk === amp.bclk && mic.ws === amp.ws);
  if (mic && amp && !sharedI2s && (mic.bclk === amp.bclk || mic.ws === amp.ws)) throw Error("共享 I²S 时钟需要同时共用 BCLK 与 WS");
  if (mic && amp && mic.data === amp.data) throw Error("麦克风输出与功放输入需要独立 GPIO，避免主控与麦克风争用数据线");
  const motor = d ? { id: d.id, enable: gpio(d.id, "SLP"), pins: ["AIN1", "AIN2", "BIN1", "BIN2"].map((p) => gpio(d.id, p)),
    loads: ["A", "B"].map((channel) => {
      const load = group(d.id, `${channel}OUT1`).map((key) => resolvePin(nodes, key)!).find((p) => p.node.type === "dcMotor")!;
      return { id: load.node.id, polarity: load.pin.id === "M1" ? 1 : -1 };
    }) } : null;
  const spec = { version: 1, oled, mic, amp, motor, sharedI2s, application };
  if (application.kind === "agent") for (const step of application.scenarios) {
    if ((!mic && (step.level || step.volume)) || (!amp && (step.volume || step.toneHz)) || (!motor && (step.motorA || step.motorB)))
      throw Error(`验收 ${step.name} 使用了当前接线没有的外设`);
  }
  const definitions: Record<string, number> = {
    HAS_OLED: +!!oled, OLED_SDA: oled?.sda ?? -1, OLED_SCL: oled?.scl ?? -1, OLED_RST: oled?.reset ?? -1,
    HAS_MIC: +!!mic, MIC_BCLK: mic?.bclk ?? -1, MIC_WS: mic?.ws ?? -1, MIC_DATA: mic?.data ?? -1, MIC_CHANNEL: mic?.channel ?? 0,
    HAS_AMP: +!!amp, AMP_BCLK: amp?.bclk ?? -1, AMP_WS: amp?.ws ?? -1, AMP_DATA: amp?.data ?? -1,
    HAS_MOTOR: +!!motor, MOTOR_ENABLE: motor?.enable ?? -1,
    MOTOR_A_POLARITY: motor?.loads[0].polarity ?? 1, MOTOR_B_POLARITY: motor?.loads[1].polarity ?? 1,
    SHARED_I2S: +sharedI2s, APP_MODE: application.kind === "agent" ? 3 : application.kind === "intercom" ? 1 : application.kind === "sound-alarm" ? 2 : 0,
    APP_VOLUME: application.kind === "intercom" ? application.volume : 50,
    APP_THRESHOLD: application.kind === "sound-alarm" ? application.threshold : 5000,
    APP_HOLD_MS: application.kind === "sound-alarm" ? application.holdMs : 500,
    APP_ALARM_HZ: application.kind === "sound-alarm" ? application.frequency : 880,
    ...Object.fromEntries(["A1", "A2", "B1", "B2"].map((name, i) => [`MOTOR_${name}`, motor?.pins[i] ?? -1])),
  };
  return { design, spec, report, header: "// Generated from the validated wiring. ESP-IDF 6.0.1 / ESP32-S3.\n#pragma once\n" +
    Object.entries(definitions).map(([key, value]) => `#define ${key} ${value}`).join("\n") + "\n" };
}
