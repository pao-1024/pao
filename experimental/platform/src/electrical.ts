import { partFor } from "./catalog.ts";
import type { Module, ModuleType, Connection, Part } from "./catalog.ts";
import { sensorDefinitions, sensorTypes, isSensor } from "./sensors.ts";

type Pin = {
  id: string; name: string; side: number; row: number; required: boolean; blocked?: boolean;
  kind: "gnd" | "power-in" | "power-out" | "gpio" | "in" | "out" | "strap" | "bridge" | "load";
  voltage?: [number, number]; sourceVoltage?: number; capacityMa?: number; currentMa?: number;
  signal?: string; family?: "audio" | "motor"; channel?: string;
};
const j1 = ["3V3", "3V3", "CHIP_PU", "GPIO4", "GPIO5", "GPIO6", "GPIO7", "GPIO15", "GPIO16", "GPIO17", "GPIO18", "GPIO8", "GPIO3", "GPIO46", "GPIO9", "GPIO10", "GPIO11", "GPIO12", "GPIO13", "GPIO14", "5V", "GND"];
const j3 = ["GND", "GPIO43", "GPIO44", "GPIO1", "GPIO2", "GPIO42", "GPIO41", "GPIO40", "GPIO39", "GPIO38", "GPIO37", "GPIO36", "GPIO35", "GPIO0", "GPIO45", "GPIO48", "GPIO47", "GPIO21", "GPIO20", "GPIO19", "GND", "GND"];
const reserved = new Set(["CHIP_PU", "GPIO0", "GPIO3", "GPIO45", "GPIO46", "GPIO19", "GPIO20", "GPIO35", "GPIO36", "GPIO37", "GPIO38", "GPIO43", "GPIO44"]);
const p = (id: string, kind: Pin["kind"], options: Partial<Pin> = {}): Pin =>
  ({ id, name: id, kind, side: 0, row: 0, required: true, ...options });
const input = (id: string, signal: string) => p(id, "in", { signal, voltage: [0, 3.6] });
const ground = () => p("GND", "gnd");
const power = (id: string, voltage: [number, number], currentMa: number) => p(id, "power-in", { voltage, currentMa });
export const pinSets: Record<ModuleType, Pin[]> = {
  ...Object.fromEntries(sensorTypes.map((type) => [type, sensorDefinitions[type].physicalPins.map((id) => {
    if (id === "VIN") return { ...power(id, [2.7,5.5], sensorDefinitions[type].currentMa), name: type === "mcp9808" ? "Vdd" : id };
    if (id === "GND") return ground();
    if (id === "SDA" || id === "SCL") return input(id, id === "SDA" ? "i2c-sda" : "i2c-scl");
    if (["ALERT", "ALR", "3Vo"].includes(id)) return p(id, id === "3Vo" ? "power-out" : "out", { required: false, blocked: true, ...(id === "3Vo" ? { sourceVoltage: 3.3 } : {}) });
    return p(id, "strap", { voltage: [0,3.6] });
  })])) as Record<typeof sensorTypes[number], Pin[]>,
  esp: [j1, j3].flatMap((names, side) => names.map((name, row) => ({
    ...p(`J${side ? 3 : 1}-${row + 1}`, name === "GND" ? "gnd" : name === "3V3" ? "power-out" : name === "5V" ? "power-in" : "gpio", {
      name, required: side === 0 && name === "5V",
      // 100 mA is a conservative project allocation for external peripherals, not the LDO's silicon rating.
      ...(name === "3V3" ? { sourceVoltage: 3.3, capacityMa: 100 } : name === "5V" ? { voltage: [4.75, 5.25] as [number, number], currentMa: 600 } : { voltage: [0, 3.6] as [number, number] }),
      blocked: reserved.has(name),
    }), side, row,
  }))),
  oled: [power("VIN", [3.3, 5], 90), p("3V3", "power-out", { sourceVoltage: 3.3, required: false, blocked: true }), ground(), input("RST", "reset"), input("SCL", "i2c-scl"), p("SDA", "in", { signal: "i2c-sda", voltage: [0, 3.6] })],
  mic: [power("VDD", [1.6, 3.6], 10), ground(), p("SEL", "strap", { voltage: [0, 3.6] }), input("WS", "i2s-lrclk"), input("BCLK", "i2s-bclk"), p("DOUT", "out", { signal: "i2s-data", voltage: [0, 3.6] })],
  speaker: [power("VIN", [2.5, 5.5], 800), ground(), p("SD_MODE", "strap", { voltage: [0, 5.5] }), p("GAIN", "strap", { voltage: [0, 5.5], required: false }), input("DIN", "i2s-data"), input("BCLK", "i2s-bclk"), input("LRC", "i2s-lrclk"), p("OUT_PLUS", "bridge", { family: "audio", channel: "audio" }), p("OUT_MINUS", "bridge", { family: "audio", channel: "audio" })],
  motor: [power("VMOTOR", [2.7, 10.8], 720), ground(), input("AIN1", "motor-control"), input("AIN2", "motor-control"), input("BIN1", "motor-control"), input("BIN2", "motor-control"), input("SLP", "enable"), p("FLT", "out", { signal: "fault", voltage: [0, 3.6], required: false, blocked: true }), ...["AOUT1", "AOUT2", "BOUT1", "BOUT2"].map((id) => p(id, "bridge", { family: "motor", channel: id[0] }))],
  supply: [p("+5V", "power-out", { name: "5V", sourceVoltage: 5, capacityMa: 4000 }), ground()],
  speakerLoad: [p("PLUS", "load", { family: "audio" }), p("MINUS", "load", { family: "audio" })],
  dcMotor: [p("M1", "load", { family: "motor" }), p("M2", "load", { family: "motor" })],
};
for (const [type, pins] of Object.entries(pinSets))
  if (type !== "esp") pins.forEach((pin, row) => { pin.row = row; });

export const endpoint = (id: number, pin: string) => `${id}:${pin}`;
export function resolvePin(nodes: Module[], key: string) {
  const [id, pinId] = key.split(":");
  const node = nodes.find((n) => n.id === Number(id));
  const pin = node && pinSets[node.type].find((p) => p.id === pinId);
  return node && pin ? { node, pin } : null;
}
export function pinLabel(nodes: Module[], key: string) {
  const p = resolvePin(nodes, key);
  return p ? `#${p.node.id} ${p.node.type.toUpperCase()} · ${p.pin.name}${p.node.type === "esp" ? ` (${p.pin.id})` : ""}` : key;
}

export function nets(nodes: Module[], connections: Pick<Connection, "a" | "b">[]) {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    if (!parent.has(k)) parent.set(k, k);
    if (parent.get(k) !== k) parent.set(k, find(parent.get(k)!));
    return parent.get(k)!;
  };
  const join = (a: string, b: string) => parent.set(find(a), find(b));
  for (const n of nodes) {
    for (const pin of pinSets[n.type]) find(endpoint(n.id, pin.id));
    if (n.type === "esp") for (const name of ["3V3", "GND"]) {
      const pins = pinSets.esp.filter((p) => p.name === name);
      for (const pin of pins.slice(1)) join(endpoint(n.id, pins[0].id), endpoint(n.id, pin.id));
    }
  }
  for (const c of connections) if (resolvePin(nodes, c.a) && resolvePin(nodes, c.b)) join(c.a, c.b);
  const groups = new Map<string, string[]>();
  for (const key of parent.keys()) {
    const root = find(key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(key);
  }
  return [...groups.values()];
}
function sourcePins(nodes: Module[], group: string[]) {
  return [...new Map(group.map((key) => resolvePin(nodes, key)!).filter((p) => p.pin.kind === "power-out")
    .map((p) => [`${p.node.id}:${p.pin.name}`, p])).values()];
}
function netError(nodes: Module[], connections: Pick<Connection, "a" | "b">[], group: string[]) {
  const ports = group.map((key) => resolvePin(nodes, key)!);
  const pins = ports.map((p) => p.pin);
  const used = group.filter((key) => connections.some((c) => c.a === key || c.b === key));
  if (used.some((key) => resolvePin(nodes, key)!.pin.blocked)) return "引脚保留或其电路尚未建模（含 FLT 外部上拉），禁止连接";
  if (pins.some((p) => p.kind === "strap") && pins.some((p) => ["gpio", "in", "out"].includes(p.kind)))
    return "当前配置脚仅支持电源或 GND 固定模式，不能混接数据或未定义初始状态的 GPIO";
  if (pins.some((p) => p.kind === "power-in") && pins.some((p) => ["gpio", "in", "out"].includes(p.kind)))
    return "信号脚不能给电源输入供电";
  const drivers = pins.filter((p) => p.kind === "bridge");
  if (drivers.length || pins.some((p) => p.kind === "load")) {
    if (pins.some((p) => !["bridge", "load"].includes(p.kind))) return "差分负载端不可接地、电源或逻辑脚";
    if (drivers.length > 1) return "不同桥臂输出不可短接";
    if (new Set(pins.map((p) => p.family)).size > 1) return "负载类型不匹配：扬声器与电机不可互换";
    if (pins.filter((p) => p.kind === "load").length > 1) return "同一输出只支持一个匹配负载端子";
    return "";
  }
  const sources = sourcePins(nodes, group);
  if (pins.some((p) => p.kind === "gnd")) {
    if (sources.length || pins.some((p) => p.kind === "power-in")) return "拒绝短接：电源正极与 GND 不可相连";
    if (pins.some((p) => !["gnd", "strap"].includes(p.kind))) return "信号端不能直接接地；只有配置脚可固定为低电平";
  }
  if (sources.length > 1) return "拒绝短接：不能并联独立电源或稳压输出（包括 3.3V 与 5V）";
  if (sources.length) {
    const voltage = sources[0].pin.sourceVoltage!;
    if (pins.some((p) => ["gpio", "in", "out"].includes(p.kind))) return "信号脚不能接到电源；使能脚请使用 GPIO 控制";
    if (pins.some((p) => p.voltage && (voltage < p.voltage[0] || voltage > p.voltage[1]))) return `电压不匹配：${voltage}V 超出端子允许范围`;
    const demand = pins.reduce((sum, pin) => sum + (pin.currentMa || 0), 0);
    if (sources[0].pin.capacityMa && demand > sources[0].pin.capacityMa) return `电流预算超限：${demand} / ${sources[0].pin.capacityMa}mA`;
  }
  const roles = new Set(pins.map((p) => p.signal).filter(Boolean));
  if (roles.size > 1) return "总线角色不匹配：时钟、数据、复位与控制信号不可混接";
  if (pins.filter((p) => p.kind === "gpio").length > 1) return "一个信号网络不能连接多个主控 GPIO";
  if (pins.filter((p) => p.kind === "out").length > 1) return "不能将多个输出端连接在同一网络";
  if (roles.has("motor-control") && pins.filter((p) => p.signal === "motor-control").length > 1) return "电机各控制脚必须独立驱动";
  return "";
}
export function connectionError(nodes: Module[], connections: Pick<Connection, "a" | "b">[], a: string, b: string) {
  if (!resolvePin(nodes, a) || !resolvePin(nodes, b)) return "引脚不存在";
  if (a === b) return "不能连接同一个引脚";
  if (connections.some((c) => c.a === a && c.b === b || c.a === b && c.b === a)) return "这两个引脚已经连接";
  const next = [...connections, { a, b }];
  const groups = nets(nodes, next);
  const error = netError(nodes, next, groups.find((g) => g.includes(a))!);
  if (error) return error;
  // Power changes can invalidate a previously connected level-shifted I2C bus.
  return logicVoltageIssues(nodes, groups)[0] || "";
}
function logicVoltageIssues(nodes: Module[], groups: string[][]) {
  const issues: string[] = [];
  for (const n of nodes.filter((n) => n.type === "oled" || isSensor(n.type))) {
    const rail = groups.find((g) => g.includes(endpoint(n.id, "VIN")))!;
    const voltage = sourcePins(nodes, rail)[0]?.pin.sourceVoltage;
    if (voltage && voltage > 3.6) for (const pin of ["SDA", "SCL"]) {
      const bus = groups.find((g) => g.includes(endpoint(n.id, pin)))!;
      if (bus.some((key) => resolvePin(nodes, key)!.node.type === "esp"))
        issues.push(`${partFor(n.type).name} #${n.id} 的 I²C 上拉随 VIN；${voltage}V 不能直连 ESP32 3.3V GPIO，请使用 3.3V VIN 或额外电平转换`);
    }
  }
  return issues;
}
export function missingPins(nodes: Module[], connections: Pick<Connection, "a" | "b">[]) {
  return nodes.flatMap((n) => pinSets[n.type].filter((p) => p.required &&
    !connections.some((c) => c.a === endpoint(n.id, p.id) || c.b === endpoint(n.id, p.id))).map((p) => endpoint(n.id, p.id)));
}

export function i2cTopology(nodes: Module[], connections: Pick<Connection,"a" | "b">[]) {
  const groups = nets(nodes, connections), issues: string[] = [];
  const group = (id: number, pin: string) => groups.find((g) => g.includes(endpoint(id,pin)))!;
  const gpio = (id: number, pin: string) => { const p = group(id,pin).map((k) => resolvePin(nodes,k)!).find((p) => p.node.type === "esp" && p.pin.kind === "gpio"); return p ? Number(p.pin.name.slice(4)) : -1; };
  const buses: { sda: number; scl: number }[] = [];
  const devices = nodes.filter((n) => n.type === "oled" || isSensor(n.type)).map((n) => {
    const route = { sda: gpio(n.id,"SDA"), scl: gpio(n.id,"SCL") };
    let bus = buses.findIndex((b) => b.sda === route.sda && b.scl === route.scl);
    if (bus < 0) { bus = buses.length; buses.push(route); }
    const def = isSensor(n.type) ? sensorDefinitions[n.type] : null;
    const bits = def?.straps.reduce((v,p,i) => v | ((sourcePins(nodes,group(n.id,p)).length ? 1 : 0) << i), 0) || 0;
    const address = def ? def.addresses[bits] : 60;
    if (n.type === "sht31" && !sourcePins(nodes,group(n.id,"RST")).some((p) => p.pin.sourceVoltage === 3.3)) issues.push(`SHT31 #${n.id} RST 必须固定为 3.3V 才能运行`);
    return { id: n.id, type: n.type, bus, address, ...route };
  });
  if (buses.length > 2) issues.push("ESP32-S3 最多支持两个硬件 I²C 控制器");
  buses.forEach((a,i) => {
    for (const b of buses.slice(i+1)) if (a.sda === b.sda || a.scl === b.scl) issues.push("不同 I²C 总线不能只共享一根时钟或数据线");
    const onBus = devices.filter((d) => d.bus === i);
    if (new Set(onBus.map((d) => d.address)).size !== onBus.length) issues.push(`I²C 总线 ${i} 地址冲突，请调整地址脚实际接线`);
    // Every selected sensor has 10k pull-ups; use a conservative 4.7k allocation for the OLED.
    const conductance = onBus.reduce((sum,d) => sum + 1 / (d.type === "oled" ? 4700 : 10000), 0);
    if (conductance && 1 / conductance < 1000) issues.push(`I²C 总线 ${i} 并联上拉过强，须减少模块或拆分总线`);
  });
  return { devices, buses, issues };
}

export function loadError(driver: Part, load: Part, supplyVolts: number) {
  const output = driver.output, rating = load.load;
  if (!output || !rating || output.family !== rating.family) return "负载类型不匹配";
  if (output.family === "audio" && rating.family === "audio") {
    if (rating.ohms < output.minOhms) return "扬声器阻抗低于功放允许值";
    if (rating.watts < output.maxWatts) return "扬声器额定功率不足";
  }
  if (output.family === "motor" && rating.family === "motor") {
    if (supplyVolts > rating.ratedVolts) return "电机供电超过额定电压";
    if (rating.stallMa > output.channelMa) return "电机堵转电流超过驱动通道限流";
  }
  return "";
}

export function referenceConnections(nodes: Module[], existing: Pick<Connection,"a" | "b">[] = []): Connection[] {
  const esp = nodes.find((n) => n.type === "esp");
  if (!esp) return [];
  const result: Connection[] = [];
  const wire = (a: string, b: string) => result.push({ id: `auto:${a}:${b}`, a, b });
  const gpio = (name: string) => endpoint(esp.id, name === "GND" ? "J3-1" : pinSets.esp.find((p) => p.name === name)!.id);
  const map: Partial<Record<ModuleType, Record<string, string>>> = {
    oled: { GND: "GND", VIN: "3V3", RST: "GPIO17", SDA: "GPIO41", SCL: "GPIO42" },
    mic: { VDD: "3V3", GND: "GND", SEL: "GND", WS: "GPIO4", BCLK: "GPIO5", DOUT: "GPIO6" },
    speaker: { SD_MODE: "3V3", GAIN: "GND", DIN: "GPIO7", BCLK: "GPIO15", LRC: "GPIO16" },
    motor: { AIN1: "GPIO11", AIN2: "GPIO12", BIN1: "GPIO13", BIN2: "GPIO14", SLP: "GPIO18" },
  };
  for (const n of nodes) for (const [pin, name] of Object.entries(map[n.type] || {}))
    wire(name === "GND" && ["SEL", "GAIN"].includes(pin) ? endpoint(n.id, "GND") : gpio(name), endpoint(n.id, pin));
  const existingGroups = nets(nodes, existing);
  for (const type of sensorTypes) {
    const def = sensorDefinitions[type], selected = nodes.filter((n) => n.type === type), used = new Set<number>();
    const known = (n: Module, pin: string) => {
      const group = existingGroups.find((g) => g.includes(endpoint(n.id, pin)))!;
      return group.some((k) => resolvePin(nodes,k)!.pin.kind === "gnd") ? 0 : sourcePins(nodes,group).some((p) => p.pin.sourceVoltage === 3.3) ? 1 : undefined;
    };
    const fixed = new Map<number,number>();
    for (const n of selected) if (def.straps.every((p) => known(n,p) !== undefined)) {
      const bits = def.straps.reduce((v,p,i) => v | (known(n,p)! << i), 0); fixed.set(n.id,bits); used.add(bits);
    }
    for (const n of selected) {
      for (const [pin,name] of Object.entries({ VIN: "3V3", GND: "GND", SDA: "GPIO41", SCL: "GPIO42" })) wire(gpio(name),endpoint(n.id,pin));
      const bits = fixed.get(n.id) ?? def.addresses.findIndex((_, value) => !used.has(value) && def.straps.every((p,i) => known(n,p) === undefined || known(n,p) === (value >> i & 1)));
      if (bits >= 0) { used.add(bits); def.straps.forEach((pin,i) => wire(gpio(bits >> i & 1 ? "3V3" : "GND"),endpoint(n.id,pin))); }
      if (type === "sht31") wire(gpio("3V3"),endpoint(n.id,"RST"));
    }
  }
  const supply = nodes.find((n) => n.type === "supply");
  if (supply) {
    wire(endpoint(supply.id, "+5V"), gpio("5V"));
    wire(gpio("GND"), endpoint(supply.id, "GND"));
    for (const n of nodes.filter((n) => ["speaker", "motor"].includes(n.type))) {
      wire(endpoint(supply.id, "+5V"), endpoint(n.id, n.type === "speaker" ? "VIN" : "VMOTOR"));
      wire(endpoint(supply.id, "GND"), endpoint(n.id, "GND"));
    }
  }
  const amp = nodes.find((n) => n.type === "speaker"), speaker = nodes.find((n) => n.type === "speakerLoad");
  if (amp && speaker) for (const [a, b] of [["OUT_PLUS", "PLUS"], ["OUT_MINUS", "MINUS"]]) wire(endpoint(amp.id, a), endpoint(speaker.id, b));
  const driver = nodes.find((n) => n.type === "motor");
  if (driver) nodes.filter((n) => n.type === "dcMotor").slice(0, 2).forEach((n, i) => {
    wire(endpoint(driver.id, `${i ? "B" : "A"}OUT1`), endpoint(n.id, "M1"));
    wire(endpoint(driver.id, `${i ? "B" : "A"}OUT2`), endpoint(n.id, "M2"));
  });
  return result;
}

export function autoConnect(nodes: Module[], existing: Connection[]) {
  const connections = [...existing], issues: string[] = [];
  if (nodes.filter((n) => n.type === "esp").length !== 1)
    return { connections, issues: ["自动接线需要且仅支持一个 ESP32 主控"] };
  const ambiguous = new Set<ModuleType>();
  for (const n of nodes) if (!isSensor(n.type) && nodes.filter((m) => m.type === n.type).length > (n.type === "dcMotor" ? 2 : 1)) ambiguous.add(n.type);
  for (const type of ambiguous) issues.push(`${partFor(type).name} 存在多个模块，当前接口分配不能确定，未自动连接`);
  for (const c of referenceConnections(nodes, existing)) {
    const source = resolvePin(nodes, c.a)!, target = resolvePin(nodes, c.b)!;
    if (ambiguous.has(source.node.type) || ambiguous.has(target.node.type)) continue;
    if (connections.some((wire) => wire.a === c.b || wire.b === c.b)) {
      if (target.pin.kind !== "gnd" || nets(nodes, connections).some((g) => g.includes(c.a) && g.includes(c.b))) continue;
    }
    const sharedI2c = ["i2c-sda", "i2c-scl"].includes(target.pin.signal || "") && nets(nodes, connections).find((g) => g.includes(c.a))!.every((k) => {
      const pin = resolvePin(nodes,k)!.pin; return pin.kind === "gpio" || pin.signal === target.pin.signal;
    });
    if (!sharedI2c && source.pin.kind === "gpio" && connections.some((wire) => wire.a === c.a || wire.b === c.a)) {
      issues.push(`${pinLabel(nodes, c.a)} 已被占用，保留原连接`); continue;
    }
    const error = connectionError(nodes, connections, c.a, c.b);
    if (error) issues.push(`${pinLabel(nodes, c.b)}：${error}`);
    else connections.push(c);
  }
  return { connections, issues: [...new Set([...issues, ...electricalReport(nodes, connections).issues])] };
}

export function electricalReport(nodes: Module[], connections: Pick<Connection, "a" | "b">[]) {
  const groups = nets(nodes, connections);
  const groupFor = (key: string) => groups.find((g) => g.includes(key)) || [];
  const issues: string[] = [];
  if (nodes.filter((n) => n.type === "esp").length !== 1) issues.push("当前设计需要且仅支持一个 ESP32 主控");
  for (const type of ["oled", "mic", "speaker", "motor", "supply"] as const)
    if (nodes.filter((n) => n.type === type).length > 1) issues.push(`${partFor(type).name} 型号重复：当前尚未支持多地址、多接口或多电源分配`);
  for (const c of connections) if (!resolvePin(nodes, c.a) || !resolvePin(nodes, c.b)) issues.push("连接包含未知引脚");
  for (const group of groups) {
    if (!group.some((key) => connections.some((c) => c.a === key || c.b === key))) continue;
    const error = netError(nodes, connections, group);
    if (error) issues.push(`${pinLabel(nodes, group[0])}：${error}`);
  }
  issues.push(...logicVoltageIssues(nodes, groups));
  issues.push(...i2cTopology(nodes,connections).issues);
  for (const key of missingPins(nodes, connections)) issues.push(`${pinLabel(nodes, key)} 必需端子未连接`);
  for (const n of nodes) {
    for (const pin of pinSets[n.type].filter((p) => p.kind === "power-in")) {
      const rail = groupFor(endpoint(n.id, pin.id));
      if (!sourcePins(nodes, rail).length) issues.push(`${pinLabel(nodes, endpoint(n.id, pin.id))} 缺少供电源`);
    }
    const groundPin = pinSets[n.type].find((p) => p.kind === "gnd");
    const supply = nodes.find((n) => n.type === "supply");
    if (groundPin && n.type !== "supply" && (!supply || !groupFor(endpoint(n.id, groundPin.id)).includes(endpoint(supply.id, "GND"))))
      issues.push(`${partFor(n.type).name} #${n.id} 缺少公共电源回路`);
    for (const pin of pinSets[n.type].filter((p) => p.required && ["in", "out"].includes(p.kind))) {
      const bus = groupFor(endpoint(n.id, pin.id));
      if (!bus.some((key) => resolvePin(nodes, key)?.pin.kind === "gpio"))
        issues.push(`${pinLabel(nodes, endpoint(n.id, pin.id))} 缺少主控 GPIO / 总线配置`);
    }
    if (["speakerLoad", "dcMotor"].includes(n.type)) {
      const terminals = pinSets[n.type];
      const outputs = terminals.map((pin) => groupFor(endpoint(n.id, pin.id)).map((key) => resolvePin(nodes, key)!).filter((p) => p.pin.kind === "bridge"));
      if (outputs.some((list) => list.length !== 1) || outputs[0][0]?.node.id !== outputs[1][0]?.node.id ||
          outputs[0][0]?.pin.channel !== outputs[1][0]?.pin.channel || outputs[0][0]?.pin.id === outputs[1][0]?.pin.id)
        issues.push(`${partFor(n.type).name} #${n.id} 的两端必须接同一驱动的同一通道两个不同输出`);
      else {
        const driver = outputs[0][0].node;
        const supply = groupFor(endpoint(driver.id, driver.type === "motor" ? "VMOTOR" : "VIN"));
        const error = loadError(partFor(driver.type), partFor(n.type), sourcePins(nodes, supply)[0]?.pin.sourceVoltage || 0);
        if (error) issues.push(`${partFor(n.type).name} #${n.id}：${error}`);
      }
    }
    if (n.type === "speaker") {
      const mode = groupFor(endpoint(n.id, "SD_MODE"));
      if (!sourcePins(nodes, mode).length) issues.push(`功放 #${n.id} 未设置有效 SD_MODE：默认方案要求直连 3.3V 选择左声道`);
    }
    for (const pin of pinSets[n.type].filter((p) => p.kind === "strap" && p.required)) {
      const group = groupFor(endpoint(n.id, pin.id));
      if (!group.some((key) => ["gnd", "power-out"].includes(resolvePin(nodes, key)!.pin.kind)))
        issues.push(`${pinLabel(nodes, endpoint(n.id, pin.id))} 缺少明确的配置电平`);
    }
  }
  const budgets = groups.flatMap((group) => {
    const sources = sourcePins(nodes, group);
    if (sources.length !== 1 || !sources[0].pin.capacityMa) return [];
    const source = sources[0];
    const demandMa = group.reduce((sum, key) => sum + (resolvePin(nodes, key)!.pin.currentMa || 0), 0);
    if (demandMa > source.pin.capacityMa!) issues.push(`${pinLabel(nodes, endpoint(source.node.id, source.pin.id))} 电流预算超限：${demandMa} / ${source.pin.capacityMa}mA`);
    return [{ source: endpoint(source.node.id, source.pin.id), voltage: source.pin.sourceVoltage!, demandMa, capacityMa: source.pin.capacityMa! }];
  });
  const gpio = nodes.filter((n) => n.type === "esp").flatMap((n) => pinSets.esp.filter((p) => p.kind === "gpio").flatMap((pin) => {
    const peers = groupFor(endpoint(n.id, pin.id)).filter((key) => key !== endpoint(n.id, pin.id)).map((key) => resolvePin(nodes, key)!);
    if (!peers.length) return [];
    return [{ gpio: pin.name, role: peers[0].pin.signal || "configuration", direction: peers[0].pin.signal?.startsWith("i2c-") ? "open-drain" : peers.some((p) => p.pin.kind === "out") ? "input" : "output", initial: ["reset", "enable", "motor-control"].includes(peers[0].pin.signal || "") ? 0 : null }];
  }));
  const microphones = nodes.filter((n) => n.type === "mic").map((n) => ({ id: n.id,
    channel: sourcePins(nodes, groupFor(endpoint(n.id, "SEL"))).length ? "right" : "left" }));
  return { issues: [...new Set(issues)], budgets, gpio,
    audio: { format: "standard-i2s", sampleRate: 48000, slotBits: 32, slots: 2, bitClock: 3072000, microphones, amplifierChannel: "left" },
    requirements: ["外部 5V 排针供电；USB 供电断开，避免电源并联",
      ...(nodes.some((n) => n.type === "oled") ? ["OLED 复位 GPIO：供电稳定后拉低 1ms，再拉高并初始化 SSD1306；I²C 使用开漏模式，板载上拉随 VIN，直连 ESP32 时 VIN=3.3V"] : []),
      ...(nodes.some((n) => ["mic", "speaker"].includes(n.type)) ? ["I²S 标准格式：48kHz、双槽各32位、BCLK=3.072MHz；声道按导出的 audio 配置，GPIO 按导出的 gpio 配置"] : []),
      ...(nodes.some((n) => n.type === "motor") ? ["DRV8833：SLP 初始为低，四路 IN 先置低，再将 SLP 置高；停止时 IN 全低；电机不得持续堵转"] : []),
      "功率模块的供电和公共地分别回到外部电源；3.3V 仅供逻辑和低功耗模块"] };
}

export function netColor(nodes: Module[], connections: Pick<Connection, "a" | "b">[], key: string) {
  const group = nets(nodes, connections).find((g) => g.includes(key)) || [key];
  const pins = group.map((k) => resolvePin(nodes, k)!.pin);
  return pins.some((p) => p.kind === "gnd") ? "#64756c" : pins.some((p) => p.sourceVoltage === 5) ? "#bd4d4d" : pins.some((p) => p.sourceVoltage === 3.3) ? "#c5793b" : "#398b88";
}

export function requiredTraceWidth(nodes: Module[], connections: Connection[], wire: Pick<Connection, "a" | "b">) {
  // Configuration inputs draw no load current; their local straps need not be power buses.
  if ([wire.a, wire.b].some((key) => resolvePin(nodes, key)?.pin.kind === "strap")) return 0.4;
  const group = nets(nodes, connections).find((g) => g.includes(wire.a)) || [wire.a];
  const pins = group.map((k) => resolvePin(nodes, k)!.pin);
  // Project routing targets for 1 oz external copper, pending board-specific thermal validation.
  if (pins.some((p) => p.sourceVoltage === 5 || p.kind === "gnd")) return 1.2;
  if (pins.some((p) => p.kind === "bridge" || p.kind === "load")) return 0.8;
  if (pins.some((p) => p.sourceVoltage === 3.3)) return 0.5;
  return 0.4;
}
