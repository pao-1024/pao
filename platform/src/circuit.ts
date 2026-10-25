import type {
  Module,
  ModuleType,
  Connection,
  Point,
  Trace,
} from "./catalog.ts";
type Pin = {
  id: string;
  name: string;
  side: number;
  row: number;
  kind: string;
  required: boolean;
  blocked?: boolean;
};
// ESP32 header names follow the vendored Espressif symbol and hardware/README.md.
const j1 = [
  "3V3",
  "3V3",
  "CHIP_PU",
  "GPIO4",
  "GPIO5",
  "GPIO6",
  "GPIO7",
  "GPIO15",
  "GPIO16",
  "GPIO17",
  "GPIO18",
  "GPIO8",
  "GPIO3",
  "GPIO46",
  "GPIO9",
  "GPIO10",
  "GPIO11",
  "GPIO12",
  "GPIO13",
  "GPIO14",
  "5V",
  "GND",
];
const j3 = [
  "GND",
  "GPIO43",
  "GPIO44",
  "GPIO1",
  "GPIO2",
  "GPIO42",
  "GPIO41",
  "GPIO40",
  "GPIO39",
  "GPIO38",
  "GPIO37",
  "GPIO36",
  "GPIO35",
  "GPIO0",
  "GPIO45",
  "GPIO48",
  "GPIO47",
  "GPIO21",
  "GPIO20",
  "GPIO19",
  "GND",
  "GND",
];
const reserved = new Set([
  "CHIP_PU",
  "GPIO0",
  "GPIO3",
  "GPIO45",
  "GPIO46",
  "GPIO19",
  "GPIO20",
  "GPIO35",
  "GPIO36",
  "GPIO37",
  "GPIO48",
]);
export const pinSets: Record<ModuleType, Pin[]> = {
  esp: [j1, j3].flatMap((row, side) =>
    row.map((name, i) => ({
      id: `J${side ? 3 : 1}-${i + 1}`,
      name,
      side,
      row: i,
      kind:
        name === "GND"
          ? "gnd"
          : name === "3V3"
            ? "v33"
            : name === "5V"
              ? "v5"
              : "io",
      required: false,
      blocked: reserved.has(name),
    })),
  ),
  oled: modulePins(
    ["VIN", "3V3", "GND", "RST", "SCL", "SDA"],
    ["v33", "v33", "gnd", "in", "in", "io"],
  ).map((p) => ({
    ...p,
    required: !["3V3", "RST"].includes(p.id),
    blocked: p.id === "3V3",
  })),
  mic: modulePins(
    ["VDD", "GND", "SEL", "WS", "BCLK", "DOUT"],
    ["v33", "gnd", "gnd", "in", "in", "out"],
  ),
  speaker: modulePins(
    [
      "VIN",
      "GND",
      "SD_MODE",
      "GAIN",
      "DIN",
      "BCLK",
      "LRC",
      "OUT_PLUS",
      "OUT_MINUS",
    ],
    ["v33", "gnd", "v33", "gnd", "in", "in", "in", "power-out", "power-out"],
  ),
  motor: modulePins(
    [
      "VMOTOR",
      "GND",
      "AIN1",
      "AIN2",
      "BIN1",
      "BIN2",
      "SLP",
      "FLT",
      "AOUT1",
      "AOUT2",
      "BOUT1",
      "BOUT2",
    ],
    [
      "v5",
      "gnd",
      "in",
      "in",
      "in",
      "in",
      "in",
      "out",
      "power-out",
      "power-out",
      "power-out",
      "power-out",
    ],
  ).map((p) => ({ ...p, required: p.id !== "FLT" })),
};
function modulePins(names: string[], kinds: string[]): Pin[] {
  return names.map((name, i) => ({
    id: name,
    name,
    kind: kinds[i],
    side: 0,
    row: i,
    required: true,
  }));
}
export function endpoint(node: number, pin: string) {
  return `${node}:${pin}`;
}
export function resolvePin(nodes: Module[], key: string) {
  const [id, pinId] = key.split(":");
  const node = nodes.find((n) => n.id === Number(id));
  const pin = node && pinSets[node.type]?.find((p) => p.id === pinId);
  return pin && node ? { node, pin } : null;
}

export function nets(
  nodes: Module[],
  connections: Pick<Connection, "a" | "b">[],
) {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    if (!parent.has(k)) parent.set(k, k);
    if (parent.get(k) !== k) parent.set(k, find(parent.get(k)!));
    return parent.get(k)!;
  };
  const join = (a: string, b: string) => parent.set(find(a), find(b));
  // Duplicate supply pins on one DevKit are electrically the same net.
  for (const n of nodes) {
    for (const name of ["3V3", "GND"]) {
      const pins = pinSets[n.type].filter(
        (p) => n.type === "esp" && p.name === name,
      );
      pins
        .slice(1)
        .forEach((p) => join(endpoint(n.id, pins[0].id), endpoint(n.id, p.id)));
    }
  }
  for (const c of connections)
    if (resolvePin(nodes, c.a) && resolvePin(nodes, c.b)) join(c.a, c.b);
  const groups = new Map<string, string[]>();
  for (const key of parent.keys()) {
    const root = find(key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(key);
  }
  return [...groups.values()];
}
export function connectionError(
  nodes: Module[],
  connections: Pick<Connection, "a" | "b">[],
  a: string,
  b: string,
) {
  const pa = resolvePin(nodes, a),
    pb = resolvePin(nodes, b);
  if (!pa || !pb) return "引脚不存在";
  if (a === b) return "不能连接同一个引脚";
  if (
    connections.some(
      (c) => (c.a === a && c.b === b) || (c.a === b && c.b === a),
    )
  )
    return "这两个引脚已经连接";
  if (pa.pin.blocked || pb.pin.blocked)
    return "该引脚在当前板型保留，或其板载电源输出尚未建模";
  const merged = nets(nodes, [...connections, { a, b }]).find((g) =>
    g.includes(a),
  )!;
  const pins = merged.map((k) => resolvePin(nodes, k)!.pin);
  const rails = new Set(
    pins
      .filter((p) => ["gnd", "v33", "v5"].includes(p.kind))
      .map((p) => p.kind),
  );
  if (rails.size > 1) return "拒绝连接：不能短接 GND、3.3 V 和 5 V 网络";
  if (
    rails.size &&
    pins.some((p) => ["io", "in", "out", "power-out"].includes(p.kind))
  )
    return "此编辑器不允许把信号端直接接到电源网络";
  if (pins.some((p) => p.kind === "power-out"))
    return "功率输出需连接匹配负载；当前模块库未提供负载模型";
  if (pins.filter((p) => p.kind === "out").length > 1)
    return "不能将多个输出端连接在同一网络";
  return "";
}
export function referenceConnections(nodes: Module[]): Connection[] {
  const esp = nodes.find((n) => n.type === "esp");
  if (!esp) return [];
  const map: Partial<Record<ModuleType, Record<string, string>>> = {
    oled: { GND: "GND", VIN: "3V3", SDA: "GPIO41", SCL: "GPIO42" },
    mic: {
      VDD: "3V3",
      GND: "GND",
      SEL: "GND",
      WS: "GPIO4",
      BCLK: "GPIO5",
      DOUT: "GPIO6",
    },
    speaker: {
      VIN: "3V3",
      GND: "GND",
      SD_MODE: "3V3",
      GAIN: "GND",
      DIN: "GPIO7",
      BCLK: "GPIO15",
      LRC: "GPIO16",
    },
    motor: {
      AIN1: "GPIO11",
      AIN2: "GPIO12",
      BIN1: "GPIO13",
      BIN2: "GPIO14",
      GND: "GND",
    },
  };
  const result = [];
  for (const n of nodes) {
    for (const [pin, name] of Object.entries(map[n.type] || {})) {
      const ep = pinSets.esp.find((p) => p.name === name)!;
      result.push({
        id: `${esp.id}-${n.id}-${pin}`,
        a: endpoint(esp.id, ep.id),
        b: endpoint(n.id, pin),
      });
    }
  }
  return result;
}
export function missingPins(
  nodes: Module[],
  connections: Pick<Connection, "a" | "b">[],
) {
  return nodes.flatMap((n) =>
    pinSets[n.type]
      .filter(
        (p) =>
          p.required &&
          !connections.some(
            (c) => c.a === endpoint(n.id, p.id) || c.b === endpoint(n.id, p.id),
          ),
      )
      .map((p) => endpoint(n.id, p.id)),
  );
}

export function autoConnect(nodes: Module[], existing: Connection[]) {
  const connections = [...existing];
  const issues: string[] = [];
  if (nodes.filter((n) => n.type === "esp").length !== 1)
    return { connections, issues: ["自动接线需要且仅支持一个 ESP32 主控；请调整模块选择。"] };
  for (const c of referenceConnections(nodes)) {
    const target = resolvePin(nodes, c.b)!;
    if (connections.some((wire) => wire.a === c.b || wire.b === c.b)) continue;
    if (nodes.filter((n) => n.type === target.node.type).length > 1) {
      issues.push(`${target.node.type} 存在多个模块，地址或接口分配尚未支持，未自动并联`);
      continue;
    }
    const source = resolvePin(nodes, c.a)!;
    if (source.pin.kind === "io" && connections.some((wire) => wire.a === c.a || wire.b === c.a)) {
      issues.push(`${pinLabel(nodes, c.a)} 已被占用，保留原连接`);
      continue;
    }
    const error = connectionError(nodes, connections, c.a, c.b);
    if (error) issues.push(`${pinLabel(nodes, c.b)}：${error}`);
    else connections.push(c);
  }
  for (const key of missingPins(nodes, connections))
    issues.push(`${pinLabel(nodes, key)} 尚无可用自动连接规则或匹配负载`);
  return { connections, issues: [...new Set(issues)] };
}
export function pinLabel(nodes: Module[], key: string) {
  const p = resolvePin(nodes, key);
  return p
    ? `#${p.node.id} ${p.node.type.toUpperCase()} · ${p.pin.name}${p.node.type === "esp" ? ` (${p.pin.id})` : ""}`
    : key;
}
export function netColor(
  nodes: Module[],
  connections: Pick<Connection, "a" | "b">[],
  key: string,
) {
  const group = nets(nodes, connections).find((g) => g.includes(key)) || [key];
  const kinds = group.map((k) => resolvePin(nodes, k)?.pin.kind);
  return kinds.includes("gnd")
    ? "#64756c"
    : kinds.includes("v33")
      ? "#c5793b"
      : kinds.includes("v5")
        ? "#bd4d4d"
        : "#398b88";
}

// Carrier connector pads, not verified module footprints. Dimensions are in mm.
export function placement(node: Module, index: number): Point {
  return (
    node.placement || {
      x: node.type === "esp" ? 12 : 55,
      y: node.type === "esp" ? 10 : 12 + Math.max(0, index - 1) * 18,
    }
  );
}
export function padPoint(nodes: Module[], key: string): Point {
  const p = resolvePin(nodes, key);
  if (!p) throw Error("未知焊盘端点");
  const pos = placement(p.node, nodes.indexOf(p.node));
  return {
    x: pos.x + (p.node.type === "esp" ? p.pin.side * 25.4 : p.pin.row * 2.54),
    y: pos.y + (p.node.type === "esp" ? p.pin.row * 2.54 : 0),
  };
}
export function routePoints(
  nodes: Module[],
  connection: Pick<Connection, "a" | "b">,
  trace: Pick<Trace, "points">,
) {
  const anchors = [
    padPoint(nodes, connection.a),
    ...trace.points,
    padPoint(nodes, connection.b),
  ];
  return anchors.flatMap((p, i) => i ? corner(anchors[i - 1], p).slice(1) : [p]);
}

// Routing anchors expand to horizontal/vertical + 45-degree copper segments.
export function corner(a: Point, b: Point): Point[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
  const elbow = { x: a.x + Math.sign(dx) * diagonal, y: a.y + Math.sign(dy) * diagonal };
  return [a, elbow, b].filter((p, i, list) => !i || Math.hypot(p.x - list[i - 1].x, p.y - list[i - 1].y) > 1e-8);
}

export const boardRules = { clearance: 0.25, edge: 0.5, padRadius: 0.8, minWidth: 0.2 };
function pointDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b));
}
function segments(points: Point[]) {
  return points.slice(1).map((b, i) => [points[i], b] as const);
}
export function traceIssues(nodes: Module[], connections: Connection[], traces: Trace[],
  board: { width: number; height: number }, trace: Trace): string[] {
  const c = connections.find((c) => c.id === trace.connection);
  if (!c) return ["走线没有对应连接"];
  if (!Number.isFinite(trace.width) || trace.width < boardRules.minWidth || trace.width > 2)
    return ["线宽须在 0.2–2 mm 范围内"];
  const points = routePoints(nodes, c, trace);
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return ["走线坐标无效"];
  const issues: string[] = [];
  const margin = trace.width / 2 + boardRules.edge;
  if (points.some((p) => p.x < margin || p.y < margin || p.x > board.width - margin || p.y > board.height - margin))
    issues.push("铜线距板边不足 0.5 mm（含线宽）");
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], d = points[i + 1];
    if ((b.x - a.x) * (d.x - b.x) + (b.y - a.y) * (d.y - b.y) < -1e-8)
      issues.push("走线存在折返或锐角，请调整拐点");
  }
  const net = new Set(nets(nodes, connections).find((g) => g.includes(c.a)) || [c.a, c.b]);
  const copper = segments(points);
  for (const node of nodes) for (const pin of pinSets[node.type]) {
    const key = endpoint(node.id, pin.id);
    if (net.has(key)) continue;
    const pad = padPoint(nodes, key);
    if (copper.some(([a, b]) => pointDistance(pad, a, b) < boardRules.padRadius + trace.width / 2 + boardRules.clearance - 1e-8))
      issues.push(`距异网焊盘 ${pinLabel(nodes, key)} 不足 0.25 mm`);
  }
  for (const other of traces) {
    if (other.connection === trace.connection || other.layer !== trace.layer) continue;
    const oc = connections.find((c) => c.id === other.connection);
    if (!oc || net.has(oc.a)) continue;
    const threshold = (other.width + trace.width) / 2 + boardRules.clearance;
    if (segments(routePoints(nodes, oc, other)).some(([c, d]) =>
      copper.some(([a, b]) => segmentDistance(a, b, c, d) < threshold - 1e-8)))
      issues.push(`与同层异网走线 ${other.connection} 的净距不足 0.25 mm`);
  }
  return [...new Set(issues)];
}

// Try short doglegs first; failure is explicit rather than accepting an obstructed route.
export function suggestTrace(nodes: Module[], connections: Connection[], traces: Trace[],
  board: { width: number; height: number }, trace: Trace): Trace | null {
  const connection = connections.find((c) => c.id === trace.connection);
  if (!connection) return null;
  const a = padPoint(nodes, connection.a), b = padPoint(nodes, connection.b);
  const candidates: Point[][] = [[], [{ x: a.x, y: b.y }], [{ x: b.x, y: a.y }]];
  for (let offset = 2; offset <= Math.max(board.width, board.height); offset += 2) {
    for (const sign of [-1, 1]) {
      candidates.push([{ x: a.x + offset * sign, y: a.y }, { x: a.x + offset * sign, y: b.y }]);
      candidates.push([{ x: a.x, y: a.y + offset * sign }, { x: b.x, y: a.y + offset * sign }]);
    }
  }
  // Escape a dense header sideways and approach the destination from above/below.
  for (const dx of [-2, 2, -4, 4, -8, 8, -16, 16])
    for (const dy of [-2, 2, -4, 4, -8, 8, -16, 16]) {
      candidates.push([{ x: a.x + dx, y: a.y }, { x: a.x + dx, y: b.y + dy }, { x: b.x, y: b.y + dy }]);
      candidates.push([{ x: a.x, y: a.y + dy }, { x: b.x + dx, y: a.y + dy }, { x: b.x + dx, y: b.y }]);
    }
  for (const points of candidates) {
    const candidate = { ...trace, points };
    if (!traceIssues(nodes, connections, traces, board, candidate).length) return candidate;
  }
  return gridRoute(nodes, connections, traces, board, trace);
}

function gridRoute(nodes: Module[], connections: Connection[], traces: Trace[],
  board: { width: number; height: number }, trace: Trace): Trace | null {
  const c = connections.find((c) => c.id === trace.connection)!;
  const start = padPoint(nodes, c.a), end = padPoint(nodes, c.b);
  const net = new Set(nets(nodes, connections).find((g) => g.includes(c.a)) || [c.a, c.b]);
  const pads = nodes.flatMap((n) => pinSets[n.type].map((p) => endpoint(n.id, p.id)))
    .filter((key) => !net.has(key)).map((key) => padPoint(nodes, key));
  const obstacles = traces.filter((t) => t.layer === trace.layer && t.connection !== trace.connection)
    .flatMap((t) => {
      const wire = connections.find((c) => c.id === t.connection);
      return !wire || net.has(wire.a) ? [] : segments(routePoints(nodes, wire, t))
        .map(([a, b]) => ({ a, b, radius: (trace.width + t.width) / 2 + boardRules.clearance + 0.01 }));
    });
  const radius = boardRules.padRadius + trace.width / 2 + boardRules.clearance + 0.01;
  const margin = trace.width / 2 + boardRules.edge + 0.01;
  const round = (n: number) => Math.round(n * 100000) / 100000;
  function axis(key: "x" | "y", max: number) {
    return [...new Set([start[key], end[key], margin, max - margin,
      ...pads.flatMap((p) => [p[key] - radius, p[key], p[key] + radius]),
      ...obstacles.flatMap((o) => [o.a[key] - o.radius, o.a[key] + o.radius, o.b[key] - o.radius, o.b[key] + o.radius]),
    ].filter((n) => n >= margin && n <= max - margin).map(round))].sort((a, b) => a - b);
  }
  const xs = axis("x", board.width), ys = axis("y", board.height), size = xs.length * ys.length;
  // shortcut: bounded planar search without vias; use a dedicated router for large/multilayer boards.
  if (size > 90000 || start.x < margin || start.y < margin || end.x < margin || end.y < margin ||
      start.x > board.width - margin || end.x > board.width - margin || start.y > board.height - margin || end.y > board.height - margin)
    return null;
  const point = (id: number): Point => ({ x: xs[Math.floor(id / ys.length)], y: ys[id % ys.length] });
  const source = xs.indexOf(round(start.x)) * ys.length + ys.indexOf(round(start.y));
  const target = xs.indexOf(round(end.x)) * ys.length + ys.indexOf(round(end.y));
  const cost = new Float64Array(size).fill(Infinity), previous = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heap: { id: number; score: number }[] = [];
  function push(id: number, score: number) {
    let i = heap.length;
    heap.push({ id, score });
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[parent].score <= score) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = { id, score };
  }
  function pop() {
    const first = heap[0], last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
        if (heap[child].score >= last.score) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first.id;
  }
  cost[source] = 0; push(source, 0);
  let visited = 0;
  while (heap.length && visited < 15000) {
    const id = pop();
    if (closed[id]) continue;
    closed[id] = 1; visited++;
    if (id === target) {
      const path: Point[] = [];
      for (let at = target; at !== -1; at = previous[at]) path.push(point(at));
      path.reverse();
      const points = path.filter((p, i) => i > 0 && i < path.length - 1 &&
        !((path[i - 1].x === p.x && path[i + 1].x === p.x) || (path[i - 1].y === p.y && path[i + 1].y === p.y)));
      const candidate = { ...trace, points };
      return traceIssues(nodes, connections, traces, board, candidate).length ? null : candidate;
    }
    const p = point(id), x = Math.floor(id / ys.length), y = id % ys.length;
    const neighbors = [x > 0 ? id - ys.length : -1, x + 1 < xs.length ? id + ys.length : -1,
      y > 0 ? id - 1 : -1, y + 1 < ys.length ? id + 1 : -1];
    for (const next of neighbors) {
      if (next < 0 || closed[next]) continue;
      const q = point(next), distance = cost[id] + Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
      if (distance >= cost[next]) continue;
      if (pads.some((pad) => pointDistance(pad, p, q) < radius - 1e-8) ||
          obstacles.some((o) => segmentDistance(p, q, o.a, o.b) < o.radius - 1e-8)) continue;
      cost[next] = distance; previous[next] = id;
      push(next, distance + Math.abs(q.x - end.x) + Math.abs(q.y - end.y));
    }
  }
  return null;
}
export function autoRoute(nodes: Module[], connections: Connection[], existing: Trace[],
  board: { width: number; height: number }, width = 0.4) {
  // Replan generated copper as a whole; keep only explicitly edited, valid routes fixed.
  const manual = existing.filter((t) => !t.automatic);
  const traces = manual.filter((t) => !traceIssues(nodes, connections, manual, board, t).length);
  const failed: Connection[] = [];
  for (const c of [...connections].reverse()) {
    if (traces.some((t) => t.connection === c.id)) continue;
    let route: Trace | null = null;
    for (const layer of ["F.Cu", "B.Cu"] as const) {
      route = suggestTrace(nodes, connections, traces, board, { connection: c.id, layer, width, points: [] });
      if (route) break;
    }
    if (route) traces.push({ ...route, automatic: true });
    else failed.push(c);
  }
  return { traces, failed };
}

export function boardIssues(
  nodes: Module[],
  connections: Connection[],
  traces: Trace[],
  board: { width: number; height: number },
) {
  const issues = [];
  for (const n of nodes)
    for (const p of pinSets[n.type]) {
      const pt = padPoint(nodes, endpoint(n.id, p.id));
      if (
        pt.x < boardRules.padRadius + boardRules.edge ||
        pt.y < boardRules.padRadius + boardRules.edge ||
        pt.x > board.width - boardRules.padRadius - boardRules.edge ||
        pt.y > board.height - boardRules.padRadius - boardRules.edge
      )
        issues.push(
          `${pinLabel(nodes, endpoint(n.id, p.id))} 焊盘铜皮距板边不足 0.5 mm`,
        );
    }
  for (const t of traces) {
    issues.push(...traceIssues(nodes, connections, traces, board, t).map((issue) => `走线 ${t.connection}：${issue}`));
  }
  const pads = nodes.flatMap((n) => pinSets[n.type].map((p) => endpoint(n.id, p.id)));
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
    const a = padPoint(nodes, pads[i]), b = padPoint(nodes, pads[j]);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * boardRules.padRadius + boardRules.clearance)
      issues.push(`焊盘重叠或间距不足：${pinLabel(nodes, pads[i])} / ${pinLabel(nodes, pads[j])}`);
  }
  return [...new Set(issues)];
}
