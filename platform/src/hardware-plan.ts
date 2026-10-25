import { catalog, completeProject, type Module, type Connection, type Trace } from "./catalog.ts";
import { autoConnect, boardIssues, placement } from "./circuit.ts";
import { firmwareProject } from "./firmware.ts";

export type HardwarePlan = { supported: boolean; title: string; summary: string; modules: { type: "esp" | "oled" | "mic" | "speaker" | "motor"; reason: string }[]; sharedI2s: boolean; board: { width: number; height: number } };
export type HardwareResult = { plan: HardwarePlan; nodes: Module[]; connections: Connection[]; board: HardwarePlan["board"]; traces: Trace[]; manufacturing: Record<string, string>; schematic: { svg: string; json: unknown }; source: string };
export class UnsupportedHardware extends Error {}

export const hardwarePlanSchema = {
  type: "object", additionalProperties: false, required: ["supported", "title", "summary", "modules", "sharedI2s", "board"], properties: {
    supported: { type: "boolean" }, title: { type: "string", maxLength: 60 }, summary: { type: "string", maxLength: 2000 },
    modules: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["type", "reason"], properties: {
      type: { type: "string", enum: ["esp", "oled", "mic", "speaker", "motor"] }, reason: { type: "string", maxLength: 500 }
    } } }, sharedI2s: { type: "boolean" },
    board: { type: "object", additionalProperties: false, required: ["width", "height"], properties: {
      width: { type: "integer", minimum: 140, maximum: 200 }, height: { type: "integer", minimum: 100, maximum: 160 }
    } }
  }
};

export function validateHardwarePlan(value: unknown): HardwarePlan {
  if (!value || typeof value !== "object") throw Error("硬件计划必须为对象");
  const p = value as HardwarePlan;
  if (typeof p.supported !== "boolean" || typeof p.summary !== "string" || !p.summary.trim() || p.summary.length > 2000) throw Error("硬件计划缺少支持状态或说明");
  if (!p.supported) throw new UnsupportedHardware(p.summary);
  if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 60 || typeof p.sharedI2s !== "boolean") throw Error("硬件标题或时钟配置无效");
  if (!p.board || !Number.isInteger(p.board.width) || p.board.width < 140 || p.board.width > 200 || !Number.isInteger(p.board.height) || p.board.height < 100 || p.board.height > 160) throw Error("载板宽度须为 140–200mm，高度须为 100–160mm");
  if (!Array.isArray(p.modules) || !p.modules.length || p.modules.length > 5) throw Error("请选择 1–5 类功能模块");
  const types = new Set<string>();
  const modules = p.modules.map((m) => {
    if (!m || !["esp", "oled", "mic", "speaker", "motor"].includes(m.type) || types.has(m.type)) throw Error("未知或重复功能模块");
    if (typeof m.reason !== "string" || !m.reason.trim() || m.reason.length > 500) throw Error("每个选型必须给出理由");
    types.add(m.type); return { type: m.type, reason: m.reason };
  });
  if (!types.has("esp")) throw Error("需要选择 ESP32 主控");
  if (p.sharedI2s && (!types.has("mic") || !types.has("speaker"))) throw Error("共享时钟需要麦克风与功放");
  return { supported: true, title: p.title, summary: p.summary, modules, sharedI2s: p.sharedI2s, board: { width: p.board.width, height: p.board.height } };
}

export function assembleHardware(value: unknown) {
  const plan = validateHardwarePlan(value);
  // Stable ordering keeps module placement independent of the model's array order.
  const chosen = ["esp", "oled", "mic", "speaker", "motor"] as const;
  const nodes = completeProject(chosen.filter((type) => plan.modules.some((m) => m.type === type)).map((type, i) => ({ id: i + 1, type, x: 70 + (i % 4) * 340, y: 80 + Math.floor(i / 4) * 350 })));
  let motor = 0;
  nodes.forEach((n, i) => { n.placement = n.type === "dcMotor" ? { x: 36 + 32 * motor++, y: 87 } : placement(n, i); });
  const connected = autoConnect(nodes, []);
  if (connected.issues.length) throw Error(`自动接线失败：${connected.issues.join("；")}`);
  const connections = connected.connections;
  if (plan.sharedI2s) {
    const mic = nodes.find((n) => n.type === "mic")!, amp = nodes.find((n) => n.type === "speaker")!;
    for (const [input, output] of [["BCLK", "BCLK"], ["WS", "LRC"]]) {
      const source = connections.find((c) => c.b === `${amp.id}:${output}`)!.a;
      connections.find((c) => c.b === `${mic.id}:${input}`)!.a = source;
    }
  }
  firmwareProject({ nodes, connections, application: { kind: "diagnostic" } });
  const issues = boardIssues(nodes, connections, [], plan.board);
  if (issues.length) throw Error(`载板布局失败：${issues.join("；")}`);
  return { plan, nodes, connections, board: plan.board };
}

export const hardwareCatalog = catalog.map(({ type, name, model, bus, note, source }) => ({ type, name, model, bus, note, source }));
