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
} from "./src/circuit.ts";
const nodes = [
  { id: 1, type: "esp" },
  { id: 2, type: "oled" },
  { id: 3, type: "mic" },
];
test("reference wiring uses real header pins and leaves no OLED inputs open", () => {
  const wires = referenceConnections(nodes);
  assert.ok(wires.some((w) => w.a === "1:J3-7" && w.b === "2:SDA"));
  assert.deepEqual(missingPins(nodes, wires), []);
  assert.ok(
    nets(nodes, wires).some((g) => g.includes("2:GND") && g.includes("3:GND")),
  );
});
test("reject duplicate, reserved, missing and transitive rail shorts", () => {
  const wires = [{ a: "1:J1-1", b: "2:VIN" }];
  assert.match(connectionError(nodes, wires, "2:VIN", "1:J1-1"), /已经/);
  assert.match(connectionError(nodes, wires, "2:VIN", "1:J1-21"), /短接/);
  assert.match(connectionError(nodes, wires, "2:VIN", "1:J1-22"), /短接/);
  assert.match(connectionError(nodes, [], "1:J3-13", "2:SDA"), /保留/);
  assert.match(connectionError(nodes, [], "1:missing", "2:SDA"), /不存在/);
  assert.match(connectionError(nodes, [], "2:3V3", "1:J1-1"), /尚未建模/);
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
  const board = { width: 100, height: 80 };
  const existing = [];
  const trace = { connection: wires[0].id, layer: "F.Cu", width: 0.4, points: [] };
  const route = suggestTrace(nodes, wires, existing, board, trace);
  assert.ok(route);
  assert.ok(traceIssues(nodes, wires, existing, board, trace).length > 0);
  assert.ok(routePoints(nodes, wires[0], route).length > 2);
  assert.deepEqual(traceIssues(nodes, wires, existing, board, route), []);
  assert.deepEqual(existing, []);
  assert.equal(suggestTrace(nodes, wires, existing, { width: 5, height: 5 }, trace), null);
  const moved = nodes.map((n) => n.id === 2 ? { ...n, placement: { x: 99, y: 12 } } : n);
  assert.ok(boardIssues(moved, wires, [route], board).some((s) => s.includes("走线")));
});
test("starter carrier pads fit inside its default board", () => {
  const starter = ["esp", "oled", "mic", "speaker", "motor"].map((type, i) => ({
    id: i + 1,
    type,
  }));
  assert.deepEqual(
    boardIssues(starter, referenceConnections(starter), [], {
      width: 100,
      height: 80,
    }),
    [],
  );
});
