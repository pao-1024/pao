import type { Module, Connection, Point, Trace } from "./catalog.ts";
import { pinSets, endpoint, resolvePin, nets, pinLabel, requiredTraceWidth, electricalReport, referenceConnections } from "./electrical.ts";
export { pinSets, endpoint, resolvePin, nets, pinLabel, requiredTraceWidth, electricalReport, missingPins, referenceConnections, autoConnect, connectionError, netColor } from "./electrical.ts";

// Carrier connector pads, not verified module footprints. Dimensions are in mm.
export function placement(node: Module, index: number): Point {
  // Place connectors by their assigned header side, with power and loads below.
  return node.placement || {
    esp: { x: 50, y: 10 },
    oled: { x: 105, y: 22 },
    mic: { x: 8, y: 12 },
    speaker: { x: 8, y: 40 },
    supply: { x: 110, y: 80 },
    speakerLoad: { x: 35, y: 50 },
    motor: { x: 8, y: 68 },
    dcMotor: { x: 8 + 32 * Math.max(0, index - 7), y: 90 },
  }[node.type];
}
export function padPoint(nodes: Module[], key: string): Point {
  const p = resolvePin(nodes, key);
  if (!p) throw Error("未知焊盘端点");
  const pos = placement(p.node, nodes.indexOf(p.node));
  return {
    x: pos.x + (p.node.type === "esp" ? p.pin.side * 22.86 : p.pin.row * 2.54),
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
  const minimum = requiredTraceWidth(nodes, connections, c);
  if (trace.width < minimum) return [`此网络线宽至少 ${minimum} mm（电源 / 负载布线规则）`];
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
  const electrical = electricalReport(nodes, connections);
  if (electrical.issues.length) return { traces: existing, failed: connections.filter((c) => !existing.some((t) => t.connection === c.id)), issues: electrical.issues };
  // Replan generated copper as a whole; keep only explicitly edited, valid routes fixed.
  const manual = existing.filter((t) => !t.automatic);
  const fixed = manual.filter((t) => !traceIssues(nodes, connections, manual, board, t).length);
  const rank = new Map(referenceConnections(nodes).map((c, i) => [c.id, i]));
  let order = [...connections].sort((a, b) => (rank.get(b.id) ?? connections.length) - (rank.get(a.id) ?? connections.length) || a.id.localeCompare(b.id));
  let best = { traces: fixed, failed: connections };
  // Rip up generated copper and prioritize blocked nets; manually edited copper stays fixed.
  for (let attempt = 0; attempt < 3; attempt++) {
    const traces = [...fixed], failed: Connection[] = [];
    for (const c of order) {
      if (traces.some((t) => t.connection === c.id)) continue;
      let route: Trace | null = null;
      for (const layer of ["F.Cu", "B.Cu"] as const) {
        route = suggestTrace(nodes, connections, traces, board, { connection: c.id, layer, width: Math.max(width, requiredTraceWidth(nodes, connections, c)), points: [] });
        if (route) break;
      }
      if (route) traces.push({ ...route, automatic: true });
      else failed.push(c);
    }
    if (failed.length < best.failed.length) best = { traces, failed };
    if (!failed.length || !traces.length) break;
    const blocked = new Set(failed.map((c) => c.id));
    order = [...failed, ...order.filter((c) => !blocked.has(c.id))];
  }
  return { ...best, issues: [] as string[] };
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
