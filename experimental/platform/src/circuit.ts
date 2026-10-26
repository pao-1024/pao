import type { Module, Connection, Point, Trace } from "./catalog.ts";
import { nets, requiredTraceWidth, electricalReport, referenceConnections } from "./electrical.ts";
import { placedFootprints, antennaSlots, boardOutline, padPoint, type Rect } from "./footprints.ts";
export { placement, padPoint } from "./footprints.ts";
export { pinSets, endpoint, resolvePin, nets, pinLabel, requiredTraceWidth, electricalReport, missingPins, referenceConnections, autoConnect, connectionError, netColor } from "./electrical.ts";

export function routePoints(
  nodes: Module[],
  connection: Pick<Connection, "a" | "b">,
  trace: Pick<Trace, "points" | "from" | "to">,
) {
  const anchors = [
    padPoint(nodes, trace.from || connection.a),
    ...trace.points,
    padPoint(nodes, trace.to || connection.b),
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

export const boardRules = { clearance: 0.25, edge: 0.5, minWidth: 0.2, minDrill: 0.3, annular: 0.25, drillClearance: 0.25, maskExpansion: 0.05, maskWeb: 0.1, holeCopper: 0.5, courtyard: 0.5, viaDiameter: 1.2, viaDrill: 0.6 };
export function pointDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b));
}
function segments(points: Point[]) {
  return points.slice(1).map((b, i) => [points[i], b] as const);
}
export function copperSegments(nodes: Module[], c: Connection, trace: Trace) {
  let layer = trace.layer;
  return segments(routePoints(nodes, c, trace)).map(([a, b]) => {
    if (trace.vias?.some((v) => Math.hypot(a.x - v.x, a.y - v.y) < 1e-6)) layer = layer === "F.Cu" ? "B.Cu" : "F.Cu";
    return { a, b, layer };
  });
}
export function rectDistance(a: Point, b: Point, r: Rect) {
  if ([a, b].some((p) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height)) return 0;
  const p = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }, { x: r.x, y: r.y }];
  return Math.min(...segments(p).map(([c, d]) => segmentDistance(a, b, c, d)));
}
function physicalObstacles(nodes: Module[]) {
  const fs = placedFootprints(nodes);
  return { pads: fs.flatMap((f) => f.pads), holes: fs.flatMap((f) => f.holes), keepouts: [...fs.flatMap((f) => f.keepouts), ...antennaSlots(nodes).filter((r) => r.height > 0)] };
}
export function traceIssues(nodes: Module[], connections: Connection[], traces: Trace[],
  board: { width: number; height: number }, trace: Trace): string[] {
  const c = connections.find((c) => c.id === trace.connection);
  if (!c) return ["走线没有对应连接"];
  const net = new Set(nets(nodes, connections).find((g) => g.includes(c.a)) || [c.a, c.b]);
  if ([trace.from || c.a, trace.to || c.b].some((p) => !net.has(p))) return ["铜线端点不属于目标网络"];
  if (!["F.Cu", "B.Cu"].includes(trace.layer) || !Array.isArray(trace.points) || trace.points.length > 1000 || trace.points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return ["铜层或走线坐标无效"];
  if (trace.vias && (!Array.isArray(trace.vias) || trace.vias.length > 20 || trace.vias.some((v) => !v || !Number.isFinite(v.x) || !Number.isFinite(v.y)))) return ["过孔坐标无效"];
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
    if (!trace.vias?.some((v) => Math.hypot(v.x - b.x, v.y - b.y) < 1e-6) && (b.x - a.x) * (d.x - b.x) + (b.y - a.y) * (d.y - b.y) < -1e-8)
      issues.push("走线存在折返或锐角，请调整拐点");
  }
  const copper = segments(points);
  const vias = trace.vias || [];
  if (vias.some((v, i) => !points.slice(1, -1).some((p) => Math.hypot(p.x - v.x, p.y - v.y) < 1e-6) || vias.slice(0, i).some((p) => Math.hypot(p.x - v.x, p.y - v.y) < boardRules.viaDiameter + boardRules.clearance))) issues.push("过孔未位于内部路径点或过孔间距不足");
  const physical = physicalObstacles(nodes);
  for (const pad of physical.pads) {
    if (net.has(pad.key)) continue;
    if (copper.some(([a, b]) => pointDistance(pad, a, b) < pad.diameter / 2 + trace.width / 2 + boardRules.clearance - 1e-8))
      issues.push(`距异网焊盘 ${pad.key} 不足 0.25 mm`);
    if (vias.some((v) => Math.hypot(v.x - pad.x, v.y - pad.y) < (pad.diameter + boardRules.viaDiameter) / 2 + boardRules.clearance - 1e-8)) issues.push(`过孔距异网焊盘 ${pad.key} 不足`);
  }
  const viaRadius = boardRules.viaDiameter / 2;
  if (vias.some((v) => v.x < viaRadius + boardRules.edge || v.y < viaRadius + boardRules.edge || v.x > board.width - viaRadius - boardRules.edge || v.y > board.height - viaRadius - boardRules.edge || physical.keepouts.some((r) => rectDistance(v, v, r) < viaRadius + boardRules.edge) || physical.holes.some((h) => Math.hypot(v.x - h.x, v.y - h.y) < viaRadius + h.drill / 2 + boardRules.holeCopper))) issues.push("过孔进入板边、安装孔或禁布区");
  if (vias.some((v) => physical.pads.some((p) => Math.hypot(v.x - p.x, v.y - p.y) < (boardRules.viaDrill + p.drill) / 2 + boardRules.drillClearance - 1e-8))) issues.push("过孔与焊盘钻孔间距不足");
  if (physical.holes.some((h) => copper.some(([a, b]) => pointDistance(h, a, b) < h.drill / 2 + boardRules.holeCopper + trace.width / 2 - 1e-8))) issues.push("铜线距非金属化安装孔不足 0.5 mm");
  if (physical.keepouts.some((r) => copper.some(([a, b]) => rectDistance(a, b, r) < trace.width / 2 + boardRules.edge - 1e-8))) issues.push("铜线进入天线、声孔、USB 或板框开槽禁布区");
  for (const other of traces) {
    if (other.connection === trace.connection) continue;
    const oc = connections.find((c) => c.id === other.connection);
    if (!oc || net.has(oc.a)) continue;
    const threshold = (other.width + trace.width) / 2 + boardRules.clearance;
    const otherCopper = copperSegments(nodes, oc, other), ownCopper = copperSegments(nodes, c, trace);
    if (otherCopper.some((o) => ownCopper.some((s) => s.layer === o.layer && segmentDistance(s.a, s.b, o.a, o.b) < threshold - 1e-8)))
      issues.push(`与同层异网走线 ${other.connection} 的净距不足 0.25 mm`);
    if (vias.some((v) => otherCopper.some((s) => pointDistance(v, s.a, s.b) < viaRadius + other.width / 2 + boardRules.clearance - 1e-8)) || (other.vias || []).some((v) => ownCopper.some((s) => pointDistance(v, s.a, s.b) < viaRadius + trace.width / 2 + boardRules.clearance - 1e-8)) || vias.some((v) => (other.vias || []).some((w) => Math.hypot(v.x - w.x, v.y - w.y) < boardRules.viaDiameter + boardRules.clearance - 1e-8))) issues.push(`过孔与异网铜线 / 过孔 ${other.connection} 间距不足`);
  }
  return [...new Set(issues)];
}

// Try short doglegs first; failure is explicit rather than accepting an obstructed route.
export function suggestTrace(nodes: Module[], connections: Connection[], traces: Trace[],
  board: { width: number; height: number }, trace: Trace): Trace | null {
  const connection = connections.find((c) => c.id === trace.connection);
  if (!connection) return null;
  const a = padPoint(nodes, trace.from || connection.a), b = padPoint(nodes, trace.to || connection.b);
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
  const start = padPoint(nodes, trace.from || c.a), end = padPoint(nodes, trace.to || c.b);
  const net = new Set(nets(nodes, connections).find((g) => g.includes(c.a)) || [c.a, c.b]);
  const physical = physicalObstacles(nodes);
  const pads = physical.pads.filter((p) => !net.has(p.key)).map((p) => ({ ...p, radius: p.diameter / 2 + trace.width / 2 + boardRules.clearance + 0.01 }));
  const trackVias = traces.flatMap((t) => (t.vias || []).map((v) => ({ ...v, net: connections.find((w) => w.id === t.connection)?.a })));
  const circles = [...pads, ...physical.holes.map((h) => ({ ...h, radius: h.drill / 2 + boardRules.holeCopper + trace.width / 2 + 0.01 })), ...trackVias.filter((v) => !v.net || !net.has(v.net)).map((v) => ({ ...v, radius: boardRules.viaDiameter / 2 + trace.width / 2 + boardRules.clearance + 0.01 }))];
  const rects = physical.keepouts.map((r) => ({ x: r.x - trace.width / 2 - boardRules.edge - 0.01, y: r.y - trace.width / 2 - boardRules.edge - 0.01,
    width: r.width + trace.width + 2 * boardRules.edge + 0.02, height: r.height + trace.width + 2 * boardRules.edge + 0.02 }));
  const obstacles = traces.filter((t) => t.connection !== trace.connection)
    .flatMap((t) => {
      const wire = connections.find((c) => c.id === t.connection);
      return !wire || net.has(wire.a) ? [] : copperSegments(nodes, wire, t)
        .map(({ a, b, layer }) => ({ a, b, layer, width: t.width, radius: (trace.width + t.width) / 2 + boardRules.clearance + 0.01 }));
    });
  const margin = trace.width / 2 + boardRules.edge + 0.01;
  const round = (n: number) => Math.round(n * 100000) / 100000;
  function axis(key: "x" | "y", max: number) {
    // A fixed mesh avoids multiplying every earlier route's obstacle coordinates; exact pad axes preserve header escapes.
    return [...new Set([start[key], end[key], margin, max - margin, ...Array.from({ length: Math.floor(max * 2) }, (_, i) => i / 2)]
      .filter((n) => n >= margin && n <= max - margin).map(round))].sort((a, b) => a - b);
  }
  const xs = axis("x", board.width), ys = axis("y", board.height), size = xs.length * ys.length;
  // shortcut: bounded two-layer search; a dedicated router is needed for dense or larger boards.
  if (size > 180000 || start.x < margin || start.y < margin || end.x < margin || end.y < margin ||
      start.x > board.width - margin || end.x > board.width - margin || start.y > board.height - margin || end.y > board.height - margin)
    return null;
  const point = (id: number): Point => ({ x: xs[Math.floor((id % size) / ys.length)], y: ys[id % ys.length] });
  const source = xs.indexOf(round(start.x)) * ys.length + ys.indexOf(round(start.y));
  const target = xs.indexOf(round(end.x)) * ys.length + ys.indexOf(round(end.y));
  const cost = new Float64Array(size * 2).fill(Infinity), previous = new Int32Array(size * 2).fill(-1);
  const closed = new Uint8Array(size * 2), viaAllowed = new Uint8Array(size);
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
  while (heap.length && visited < 120000) {
    const id = pop();
    if (closed[id]) continue;
    closed[id] = 1; visited++;
    if (id % size === target) {
      const ids: number[] = [];
      for (let at = id; at !== -1; at = previous[at]) ids.push(at);
      ids.reverse();
      const vias = ids.filter((v, i) => i > 0 && ids[i - 1] % size === v % size).map(point);
      const path = ids.filter((v, i) => !i || ids[i - 1] % size !== v % size).map(point);
      const points = path.filter((p, i) => i > 0 && i < path.length - 1 &&
        (vias.some((v) => v.x === p.x && v.y === p.y) || !((path[i - 1].x === p.x && path[i + 1].x === p.x) || (path[i - 1].y === p.y && path[i + 1].y === p.y))));
      const candidate = { ...trace, points, vias };
      const errors = traceIssues(nodes, connections, traces, board, candidate);
      return errors.length ? null : candidate;
    }
    const p = point(id), x = Math.floor((id % size) / ys.length), y = id % ys.length;
    const neighbors = [x > 0 ? id - ys.length : -1, x + 1 < xs.length ? id + ys.length : -1,
      y > 0 ? id - 1 : -1, y + 1 < ys.length ? id + 1 : -1, id < size ? id + size : id - size];
    for (const next of neighbors) {
      if (next < 0 || closed[next]) continue;
      const q = point(next), swap = id % size === next % size;
      const distance = cost[id] + (swap ? 8 : Math.abs(p.x - q.x) + Math.abs(p.y - q.y));
      if (distance >= cost[next]) continue;
      if (swap) {
        const base = id % size, radius = boardRules.viaDiameter / 2;
        if (base === source || base === target) continue;
        if (!viaAllowed[base]) {
          const valid = p.x >= radius + boardRules.edge && p.y >= radius + boardRules.edge && p.x <= board.width - radius - boardRules.edge && p.y <= board.height - radius - boardRules.edge &&
            physical.pads.every((s) => Math.hypot(p.x - s.x, p.y - s.y) >= radius + s.diameter / 2 + boardRules.clearance + 0.01) &&
            physical.holes.every((h) => Math.hypot(p.x - h.x, p.y - h.y) >= radius + h.drill / 2 + boardRules.holeCopper + 0.01) &&
            physical.keepouts.every((r) => rectDistance(p, p, r) >= radius + boardRules.edge + 0.01) &&
            trackVias.every((v) => Math.hypot(p.x - v.x, p.y - v.y) >= boardRules.viaDiameter + boardRules.clearance + 0.01) &&
            obstacles.every((o) => pointDistance(p, o.a, o.b) >= radius + o.width / 2 + boardRules.clearance + 0.01);
          viaAllowed[base] = valid ? 1 : 2;
        }
        if (viaAllowed[base] !== 1) continue;
      } else {
        const layer = id < size ? trace.layer : trace.layer === "F.Cu" ? "B.Cu" : "F.Cu";
        if (circles.some((pad) => pointDistance(pad, p, q) < pad.radius - 1e-8) || rects.some((r) => rectDistance(p, q, r) < 1e-8) ||
            obstacles.some((o) => o.layer === layer && segmentDistance(p, q, o.a, o.b) < o.radius - 1e-8)) continue;
      }
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
      // Route a multi-drop net from its already connected pads, rather than forcing every branch through one header pin.
      const joined = copperComponent(c.a, connections, traces);
      const target = padPoint(nodes, c.b);
      const sources = [...joined].sort((a, b) => {
        const p = padPoint(nodes, a), q = padPoint(nodes, b);
        return Math.hypot(p.x - target.x, p.y - target.y) - Math.hypot(q.x - target.x, q.y - target.y);
      });
      for (const from of sources) {
        for (const layer of ["F.Cu", "B.Cu"] as const) {
          route = suggestTrace(nodes, connections, traces, board, { connection: c.id, from, to: c.b, layer, width: Math.max(width, requiredTraceWidth(nodes, connections, c)), points: [] });
          if (route) break;
        }
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

export function copperComponent(start: string, connections: Connection[], traces: Trace[]) {
  const found = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of traces) {
      const c = connections.find((c) => c.id === t.connection);
      if (!c) continue;
      const a = t.from || c.a, b = t.to || c.b;
      if (found.has(a) !== found.has(b)) { found.add(a); found.add(b); changed = true; }
    }
  }
  return found;
}

export function boardIssues(
  nodes: Module[],
  connections: Connection[],
  traces: Trace[],
  board: { width: number; height: number },
) {
  const issues: string[] = [];
  if (!Number.isFinite(board.width) || !Number.isFinite(board.height) || board.width <= 0 || board.height <= 0 || board.width > 200 || board.height > 160) return ["板框尺寸无效（最大 200×160 mm）"];
  const fs = placedFootprints(nodes), holes = fs.flatMap((f) => f.holes);
  const pads = [...fs.flatMap((f) => f.pads), ...traces.flatMap((t) => (Array.isArray(t.vias) ? t.vias : []).filter((v) => v && Number.isFinite(v.x) && Number.isFinite(v.y)).map((v, i) => ({ ...v, diameter: boardRules.viaDiameter, drill: boardRules.viaDrill, key: `${t.connection}:via${i}` })))];
  const outside = (r: Rect) => r.x < 0 || r.y < 0 || r.x + r.width > board.width || r.y + r.height > board.height;
  for (const f of fs) {
    if (Object.values(f.body).some((v) => !Number.isFinite(v)) || outside(f.body)) issues.push(`U${f.id} 模块外形超出板框`);
    for (const other of fs.filter((g) => g.id > f.id)) {
      const a = f.body, b = other.body, gap = boardRules.courtyard;
      if (a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y) issues.push(`U${f.id} / U${other.id} 模块占位间距不足 ${gap} mm`);
    }
    for (const other of fs.filter((g) => g.id !== f.id)) for (const r of other.keepouts) {
      const a = f.body;
      if (a.x < r.x + r.width && a.x + a.width > r.x && a.y < r.y + r.height && a.y + a.height > r.y) issues.push(`U${f.id} 模块阻挡 U${other.id} ${r.name}`);
    }
  }
  const outline = boardOutline(nodes, board);
  for (const slot of antennaSlots(nodes)) {
    if (slot.height <= 0 || slot.x <= 0 || slot.x + slot.width >= board.width || slot.height >= board.height) issues.push("天线开槽超出板框或不再连通板边");
    for (const f of fs.filter((f) => f.type !== "esp")) if (f.body.x < slot.x + slot.width && f.body.x + f.body.width > slot.x && f.body.y < slot.height) issues.push(`U${f.id} 模块位于天线开槽内`);
  }
  for (const p of pads) {
    if (p.drill < boardRules.minDrill || (p.diameter - p.drill) / 2 < boardRules.annular) issues.push(`${p.key} 钻孔或环宽不足`);
    if (outside({ x: p.x - p.diameter / 2 - boardRules.edge, y: p.y - p.diameter / 2 - boardRules.edge, width: p.diameter + 2 * boardRules.edge, height: p.diameter + 2 * boardRules.edge }) || segments(outline).some(([a, b]) => pointDistance(p, a, b) < p.diameter / 2 + boardRules.edge - 1e-8)) issues.push(`${p.key} 焊盘铜皮距板边不足 0.5 mm`);
    for (const h of holes) if (Math.hypot(p.x - h.x, p.y - h.y) < p.diameter / 2 + h.drill / 2 + boardRules.holeCopper - 1e-8) issues.push(`${p.key} 铜皮距非金属化孔不足 0.5 mm`);
    if (physicalObstacles(nodes).keepouts.some((r) => rectDistance(p, p, r) < p.diameter / 2 + boardRules.edge - 1e-8)) issues.push(`${p.key} 焊盘进入禁布区`);
  }
  for (const h of holes) if (segments(outline).some(([a, b]) => pointDistance(h, a, b) < h.drill / 2 + boardRules.edge)) issues.push("安装孔距板边不足");
  const drills = [...pads, ...holes];
  for (let i = 0; i < drills.length; i++) for (let j = i + 1; j < drills.length; j++) if (Math.hypot(drills[i].x - drills[j].x, drills[i].y - drills[j].y) < (drills[i].drill + drills[j].drill) / 2 + boardRules.drillClearance - 1e-8) issues.push("钻孔间距不足");
  for (const t of traces) {
    issues.push(...traceIssues(nodes, connections, traces, board, t).map((issue) => `走线 ${t.connection}：${issue}`));
  }
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
    const a = pads[i], b = pads[j], gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.diameter + b.diameter) / 2;
    if (gap < boardRules.clearance - 1e-8) issues.push(`焊盘重叠或间距不足：${a.key} / ${b.key}`);
    if (gap - 2 * boardRules.maskExpansion < boardRules.maskWeb - 1e-8) issues.push(`阻焊桥不足：${a.key} / ${b.key}`);
  }
  return [...new Set(issues)];
}
