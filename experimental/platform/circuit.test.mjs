import test from "node:test";
import assert from "node:assert/strict";
import {
  connectionError,
  referenceConnections,
  nets,
  missingPins,
  padPoint,
  boardIssues,
  routePoints,
  traceIssues,
  suggestTrace,
  autoConnect,
  autoRoute,
  electricalReport,
  requiredTraceWidth,
} from "./src/circuit.ts";
import { starter, defaultBoard, completeProject } from "./src/catalog.ts";
import { loadError } from "./src/electrical.ts";
import { partFor } from "./src/catalog.ts";
const nodes = [
  { id: 1, type: "esp" },
  { id: 2, type: "oled" },
  { id: 3, type: "mic" },
];
test("reference wiring uses real header pins and leaves no OLED inputs open", () => {
  const project = completeProject(nodes);
  const wires = referenceConnections(project);
  assert.ok(wires.some((w) => w.a === "1:J3-7" && w.b === "2:SDA"));
  assert.deepEqual(missingPins(project, wires), []);
  assert.ok(wires.some((w) => w.b === "2:RST"));
  assert.deepEqual(electricalReport(project, wires).issues, []);
  assert.ok(
    nets(nodes, wires).some((g) => g.includes("2:GND") && g.includes("3:GND")),
  );
});
test("reject duplicate, reserved, missing and transitive rail shorts", () => {
  const wires = [{ a: "1:J1-1", b: "2:VIN" }];
  assert.match(connectionError(nodes, wires, "2:VIN", "1:J1-1"), /已经/);
  assert.match(connectionError(nodes, wires, "2:VIN", "1:J1-21"), /电压/);
  assert.match(connectionError(nodes, wires, "2:VIN", "1:J1-22"), /短接/);
  assert.match(connectionError(nodes, [], "1:J3-13", "2:SDA"), /保留/);
  assert.match(connectionError(nodes, [], "1:missing", "2:SDA"), /不存在/);
  assert.match(connectionError(nodes, [], "2:3V3", "1:J1-1"), /保留/);
  assert.equal(connectionError(nodes, [], "1:J3-7", "2:SDA"), "");
});
test("board positions use mm and detect bounds after placement changes", () => {
  const placed = [{ id: 1, type: "esp", placement: { x: 10, y: 10 } }];
  assert.equal(padPoint(placed, "1:J1-2").y, 12.54);
  assert.deepEqual(boardIssues(placed, [], [], { width: 100, height: 80 }), []);
  placed[0].placement.x = 99;
  assert.ok(boardIssues(placed, [], [], { width: 100, height: 80 }).length > 0);
});
test("moving a connector updates route endpoints without changing waypoints", () => {
  const placed = [
    { id: 1, type: "esp", placement: { x: 10, y: 10 } },
    { id: 2, type: "oled", placement: { x: 55, y: 12 } },
  ];
  const wire = { a: "1:J1-1", b: "2:VIN" },
    trace = { points: [{ x: 25, y: 5 }] };
  const before = routePoints(placed, wire, trace);
  placed[0].placement.x = 15;
  const after = routePoints(placed, wire, trace);
  assert.equal(after[0].x - before[0].x, 5);
  assert.ok(after.some((p) => p.x === 25 && p.y === 5));
  assert.deepEqual(after.at(-1), before.at(-1));
  for (let i = 1; i < after.length; i++) {
    const dx = Math.abs(after[i].x - after[i - 1].x), dy = Math.abs(after[i].y - after[i - 1].y);
    assert.ok(dx === 0 || dy === 0 || Math.abs(dx - dy) < 1e-8);
  }
});

test("routing avoids unrelated pads and refuses clearance violations on either copper layer", () => {
  const placed = [{ id: 1, type: "oled", placement: { x: 10, y: 10 } },
    { id: 2, type: "oled", placement: { x: 40, y: 30 } }];
  const wires = [{ id: "signal", a: "1:SDA", b: "2:VIN" }];
  const board = { width: 80, height: 60 };
  const direct = { connection: "signal", layer: "F.Cu", width: 0.4, points: [{ x: 10, y: 10 }] };
  assert.ok(traceIssues(placed, wires, [], board, direct).some((s) => s.includes("焊盘")));
  assert.ok(traceIssues(placed, wires, [], board, { ...direct, layer: "B.Cu" }).some((s) => s.includes("焊盘")));
  const route = suggestTrace(placed, wires, [], board, { ...direct, points: [] });
  assert.ok(route);
  assert.deepEqual(traceIssues(placed, wires, [], board, route), []);
  assert.ok(traceIssues(placed, wires, [], board, { ...route, width: 0.1 }).length);
  assert.ok(traceIssues(placed, wires, [], board, { ...route, points: [{ x: 0.1, y: 5 }] }).some((s) => s.includes("板边")));
});

test("same-layer cross-net copper crossing is blocked but opposite-layer crossing is allowed", () => {
  const placed = [
    { id: 1, type: "oled", placement: { x: 10, y: 10 } },
    { id: 2, type: "oled", placement: { x: 40, y: 40 } },
    { id: 3, type: "oled", placement: { x: 10, y: 40 } },
    { id: 4, type: "oled", placement: { x: 40, y: 10 } },
  ];
  const wires = [{ id: "a", a: "1:VIN", b: "2:VIN" }, { id: "b", a: "3:VIN", b: "4:VIN" }];
  const a = { connection: "a", layer: "F.Cu", width: 0.4, points: [] };
  const b = { ...a, connection: "b" };
  const board = { width: 80, height: 60 };
  assert.ok(traceIssues(placed, wires, [a], board, b).some((s) => s.includes("同层")));
  assert.deepEqual(traceIssues(placed, wires, [a], board, { ...b, layer: "B.Cu" }), []);
  placed[1].placement = { x: 10, y: 10 };
  assert.ok(boardIssues(placed, wires, [], board).some((s) => s.includes("焊盘重叠")));
});

test("router escapes a dense header and reports impossible routes without mutating traces", () => {
  const wires = referenceConnections(nodes);
  const board = defaultBoard;
  const existing = [];
  const trace = { connection: wires[0].id, layer: "F.Cu", width: 1.2, points: [] };
  const route = suggestTrace(nodes, wires, existing, board, trace);
  assert.ok(route);
  assert.ok(traceIssues(nodes, wires, existing, board, trace).length > 0);
  assert.ok(routePoints(nodes, wires[0], route).length > 2);
  assert.deepEqual(traceIssues(nodes, wires, existing, board, route), []);
  assert.deepEqual(existing, []);
  assert.equal(suggestTrace(nodes, wires, existing, { width: 5, height: 5 }, trace), null);
  const moved = nodes.map((n) => n.id === 2 ? { ...n, placement: { x: 139, y: 12 } } : n);
  assert.ok(boardIssues(moved, wires, [route], board).some((s) => s.includes("走线")));
});
test("starter carrier pads fit inside its default board", () => {
  const starter = ["esp", "oled", "mic", "speaker", "motor"].map((type, i) => ({
    id: i + 1,
    type,
  }));
  assert.deepEqual(
    boardIssues(starter, referenceConnections(starter), [], defaultBoard),
    [],
  );
});

test("automatic wiring adds known interfaces once and preserves manual connections", () => {
  const project = completeProject(nodes);
  const result = autoConnect(project, []);
  assert.deepEqual(result.connections, referenceConnections(project));
  assert.deepEqual(result.issues, []);
  assert.deepEqual(autoConnect(project, result.connections).connections, result.connections);
  const manual = [{ id: "manual", a: "1:J3-8", b: "2:SDA" }];
  const changed = autoConnect(project, manual);
  assert.equal(changed.connections[0], manual[0]);
  assert.equal(changed.connections.filter((c) => c.b === "2:SDA").length, 1);
  const occupied = autoConnect(project, [{ id: "occupied", a: "1:J3-7", b: "2:RST" }]);
  assert.ok(occupied.issues.some((s) => s.includes("占用")));
  assert.ok(!occupied.connections.some((c) => c.b === "2:SDA"));
  assert.equal(autoConnect(nodes.filter((n) => n.type !== "esp"), []).connections.length, 0);
  assert.equal(autoConnect([...nodes, { id: 4, type: "esp" }], []).connections.length, 0);
  const duplicate = autoConnect([...project, { id: 99, type: "oled" }], []);
  assert.ok(duplicate.issues.some((s) => s.includes("多个模块")));
  assert.ok(!duplicate.connections.some((c) => c.b.startsWith("2:") || c.b.startsWith("99:")));
});

test("automatic PCB routing completes all starter nets and preserves valid copper on repeat", () => {
  const board = defaultBoard, connections = referenceConnections(starter);
  const result = autoRoute(starter, connections, [], board);
  assert.equal(result.traces.length, connections.length);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(boardIssues(starter, connections, result.traces, board), []);
  assert.deepEqual(autoRoute(starter, connections, result.traces, board).traces, result.traces);
  assert.deepEqual(autoRoute(starter, [...connections].reverse(), [], board).failed, []);
  let incremental = [];
  for (let count = 2; count <= starter.length; count++) {
    const subset = completeProject(starter.slice(0, count)), wires = referenceConnections(subset);
    const step = autoRoute(subset, wires, incremental, board);
    assert.deepEqual(step.issues, []);
    assert.equal(step.traces.length + step.failed.length, wires.length);
    assert.deepEqual(boardIssues(subset, wires, step.traces, board), []);
    incremental = step.traces;
  }
  const manual = { ...result.traces[0], automatic: false };
  assert.equal(autoRoute(starter, connections, [manual], board).traces[0], manual);
  const blocked = autoRoute(starter, connections, [], { width: 5, height: 5 });
  assert.equal(blocked.traces.length, 0);
  assert.equal(blocked.failed.length, connections.length);
  assert.deepEqual(autoConnect(starter, []).issues, []);
});

test("electrical rules distinguish valid configuration levels, voltage ranges and bus roles", () => {
  assert.equal(connectionError(starter, [], "1:J1-1", "3:SEL"), "");
  assert.match(connectionError(starter, [], "2:SCL", "3:DOUT"), /总线角色/);
  assert.match(connectionError(starter, [], "5:+5V", "3:VDD"), /电压/);
  assert.match(connectionError(starter, [], "5:+5V", "1:J3-7"), /信号脚/);
  assert.match(connectionError(starter, [], "1:J3-8", "3:VDD"), /信号脚/);
  assert.match(connectionError(starter, [], "1:J3-10", "2:SDA"), /保留/);
  assert.equal(connectionError(starter, [], "5:+5V", "2:VIN"), "");
  const poweredOled = [{ a: "5:+5V", b: "2:VIN" }];
  assert.match(connectionError(starter, poweredOled, "1:J3-7", "2:SDA"), /上拉/);
  const connectedOled = [{ a: "1:J3-7", b: "2:SDA" }];
  assert.match(connectionError(starter, connectedOled, "5:+5V", "2:VIN"), /上拉/);
  assert.match(connectionError(starter, [], "4:OUT_MINUS", "1:J1-22"), /差分负载/);
  assert.match(connectionError(starter, [], "4:OUT_PLUS", "4:OUT_MINUS"), /输出不可短接/);
  assert.match(connectionError(starter, [], "1:J1-1", "5:+5V"), /不能并联/);
  assert.match(connectionError(starter, [], "1:J1-1", "4:VIN"), /电流预算/);
});

test("complete design reports removed reset, supply, ground and load instead of claiming success", () => {
  const wires = referenceConnections(starter);
  for (const key of ["2:RST", "5:GND", "1:J1-21", "6:MINUS"]) {
    const broken = wires.filter((c) => c.a !== key && c.b !== key);
    const report = electricalReport(starter, broken);
    assert.ok(report.issues.length, key);
    assert.ok(autoRoute(starter, broken, [], defaultBoard).issues.length);
    assert.equal(autoRoute(starter, broken, [], defaultBoard).traces.length, 0);
  }
  const invalid = [...wires, { id: "bad", a: "2:SCL", b: "3:DOUT" }];
  assert.ok(autoConnect(starter, invalid).issues.some((s) => s.includes("总线角色")));
  const badPair = wires.map((c) => c.b === "6:MINUS" ? { ...c, a: "4:OUT_PLUS" } : c);
  assert.ok(electricalReport(starter, badPair).issues.some((s) => s.includes("负载")));
});

test("automatic dependencies complete motor power, enable and two matched loads", () => {
  const project = completeProject([...starter, { id: 7, type: "motor", x: 0, y: 0 }]);
  assert.equal(project.filter((n) => n.type === "dcMotor").length, 2);
  assert.deepEqual(completeProject(project), project);
  const connected = autoConnect(project, []);
  assert.deepEqual(connected.issues, []);
  assert.ok(connected.connections.some((c) => c.a === "5:+5V" && c.b === "7:VMOTOR"));
  assert.ok(connected.connections.some((c) => c.b === "7:SLP"));
  const report = electricalReport(project, connected.connections);
  assert.deepEqual(report.budgets.map((b) => [b.voltage, b.demandMa, b.capacityMa]), [[3.3, 100, 100], [5, 2120, 4000]]);
  assert.ok(report.gpio.some((p) => p.gpio === "GPIO18" && p.role === "enable" && p.initial === 0));
  assert.ok(report.gpio.some((p) => p.gpio === "GPIO17" && p.role === "reset" && p.initial === 0));
  assert.ok(report.gpio.some((p) => p.role === "i2c-sda" && p.direction === "open-drain"));
  assert.equal(report.audio.bitClock, 3072000);
  const crossed = connected.connections.map((c) => c.b === "8:M2" ? { ...c, a: "7:BOUT2" } : c);
  assert.ok(electricalReport(project, crossed).issues.some((s) => s.includes("同一通道")));
  assert.match(connectionError(project, [], "7:AOUT1", "6:PLUS"), /负载类型/);
  const pcb = autoRoute(project, connected.connections, [], defaultBoard);
  assert.deepEqual(pcb.issues, []);
  assert.deepEqual(pcb.failed, []);
  assert.equal(pcb.traces.length, connected.connections.length);
  assert.ok(pcb.traces.every((t) => t.width >= requiredTraceWidth(project, connected.connections, connected.connections.find((c) => c.id === t.connection))));
  assert.deepEqual(boardIssues(project, connected.connections, pcb.traces, defaultBoard), []);
});

test("load ratings and aggregate power budgets reject unsafe combinations", () => {
  assert.equal(loadError(partFor("speaker"), partFor("speakerLoad"), 5), "");
  assert.match(loadError(partFor("speaker"), { ...partFor("speakerLoad"), load: { family: "audio", ohms: 2, watts: 3 } }, 5), /阻抗/);
  assert.match(loadError(partFor("speaker"), { ...partFor("speakerLoad"), load: { family: "audio", ohms: 4, watts: 1 } }, 5), /功率/);
  assert.match(loadError(partFor("motor"), { ...partFor("dcMotor"), load: { family: "motor", ratedVolts: 6, stallMa: 1500 } }, 5), /电流/);
  assert.match(loadError(partFor("motor"), partFor("dcMotor"), 9), /电压/);
  const project = [...starter, ...[7, 8, 9, 10].map((id) => ({ id, type: "speaker", x: 0, y: 0 }))];
  const wires = [...referenceConnections(starter), ...[7, 8, 9, 10].map((id) => ({ id: `extra${id}`, a: "5:+5V", b: `${id}:VIN` }))];
  assert.ok(electricalReport(project, wires).issues.some((s) => s.includes("电流预算超限")));
  assert.ok(electricalReport([], []).issues.length);
  const right = referenceConnections(starter).map((c) => c.b === "3:SEL" ? { ...c, a: "1:J1-1" } : c);
  assert.deepEqual(electricalReport(starter, right).issues, []);
  assert.equal(electricalReport(starter, right).audio.microphones[0].channel, "right");
});
