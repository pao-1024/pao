import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { starter, defaultBoard, completeProject } from "./src/catalog.ts";
import { autoRoute, boardIssues, padPoint, referenceConnections, routePoints } from "./src/circuit.ts";
import { placedFootprints, boardOutline } from "./src/footprints.ts";
import { manufacturingDrc, manufacturingFiles, manufacturingZip } from "./src/manufacturing.ts";

test("manufacturing uses real module pin order, all physical holes, and external-load terminals", () => {
  const fs = placedFootprints(starter), mic = fs.find((f) => f.type === "mic");
  const p = (id) => padPoint(starter, `3:${id}`);
  assert.ok(p("BCLK").x < p("GND").x && p("BCLK").x > p("DOUT").x);
  assert.equal(mic.holes.length, 2);
  assert.equal(fs.find((f) => f.type === "oled").holes.length, 4);
  const amp = fs.find((f) => f.type === "speaker").pads;
  const plus = amp.find((p) => p.pin === "OUT_PLUS"), minus = amp.find((p) => p.pin === "OUT_MINUS");
  assert.ok(Math.abs(Math.hypot(plus.x - minus.x, plus.y - minus.y) - 3.5) < 1e-8);
  const motor = placedFootprints(completeProject([...starter, { id: 7, type: "motor" }])).find((f) => f.type === "motor");
  assert.equal(motor.pads.length, 16); // Includes otherwise unconnected sense/power pads, which remain copper obstacles.
  const terminal = fs.find((f) => f.type === "supply");
  assert.ok(Math.abs(terminal.pads[1].x - terminal.pads[0].x - 5.08) < 1e-8);
  const outline = boardOutline(starter, defaultBoard);
  assert.deepEqual(outline[0], outline.at(-1));
  assert.ok(outline.length > 5); // The antenna cutout is part of the machined profile.
});

test("complete manufacturing package is CRC-valid ZIP and refuses incomplete, shorted or disconnected copper", () => {
  const nodes = starter, connections = referenceConnections(nodes), board = defaultBoard;
  const routed = autoRoute(nodes, connections, [], board);
  assert.deepEqual(routed.failed, []);
  assert.equal(manufacturingDrc(nodes, connections, routed.traces, board).passed, true);
  const files = manufacturingFiles(nodes, connections, routed.traces, board);
  const zip = manufacturingZip(files);
  const unpacked = JSON.parse(execFileSync("python3", ["-c", "import sys,io,zipfile,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))"], { input: zip, maxBuffer: 4e6 }).toString());
  assert.deepEqual(unpacked, files);
  assert.equal(JSON.parse(unpacked["drc.json"]).passed, true);
  for (const traces of [routed.traces.slice(1), [...routed.traces, routed.traces[0]],
    routed.traces.map((t, i) => i ? t : { ...t, width: 0.1 }),
    routed.traces.map((t, i) => i ? t : { ...t, from: "6:PLUS" }),
    routed.traces.map((t, i) => i ? t : { ...t, from: connections.find((c) => c.id === t.connection).b }),
    routed.traces.map((t, i) => i ? t : { ...t, points: [{ x: 60, y: 1 }] })])
    assert.throws(() => manufacturingFiles(nodes, connections, traces, board), /制造 DRC/);
  const misplaced = nodes.map((n) => n.id === 2 ? { ...n, placement: { x: 50, y: 20 } } : n);
  assert.ok(boardIssues(misplaced, connections, [], board).some((s) => s.includes("模块占位")));
  const blockedUsb = nodes.map((n) => n.id === 2 ? { ...n, placement: { x: 54, y: 73 } } : n);
  assert.ok(boardIssues(blockedUsb, connections, [], board).some((s) => s.includes("USB 插头操作空间")));
  const offboard = nodes.map((n) => n.id === 2 ? { ...n, placement: { x: 130, y: 20 } } : n);
  assert.throws(() => manufacturingFiles(offboard, connections, routed.traces, board), /超出板框/);
});

test("actual copper endpoints preserve all logical multi-drop connections", () => {
  const connections = referenceConnections(starter), r = autoRoute(starter, connections, [], defaultBoard);
  assert.ok(r.traces.some((t) => t.from !== connections.find((c) => c.id === t.connection).a));
  for (const t of r.traces) {
    const points = routePoints(starter, connections.find((c) => c.id === t.connection), t);
    assert.deepEqual(points[0], padPoint(starter, t.from));
    assert.deepEqual(points.at(-1), padPoint(starter, t.to));
  }
  assert.equal(manufacturingDrc(starter, connections, r.traces, defaultBoard).passed, true);
});
