import test from "node:test";
import assert from "node:assert/strict";
import { compileHardware, hardwareDesign } from "./src/hardware.ts";
import { referenceConnections } from "./src/circuit.ts";
import { completeProject, starter } from "./src/catalog.ts";
import { firmwareProject } from "./src/firmware.ts";

test("tscircuit renders the selected modules and current pin connections", async () => {
  const nodes = completeProject([
    { id: 1, type: "esp", x: 0, y: 0 },
    { id: 2, type: "oled", x: 400, y: 0 },
  ]);
  const connections = referenceConnections(nodes);
  const result = await compileHardware(nodes, connections);
  assert.match(result.svg, /<svg/);
  const components = result.json.filter((e) => e.type === "source_component");
  assert.deepEqual(components.map((c) => c.name).sort(), ["U1", "U2", "U3"]);
  assert.equal(
    result.json.filter((e) => e.type === "source_trace").length,
    connections.length,
  );
  assert.ok(result.json.some((e) => e.type === "schematic_component"));
  assert.equal(
    result.json.some((e) => e.type === "pcb_component"),
    false,
  );
  const changed = connections.map((c) =>
    c.b === "2:SDA" ? { ...c, a: "1:J3-8" } : c,
  );
  assert.notDeepEqual(
    hardwareDesign(nodes, changed).connections,
    hardwareDesign(nodes, connections).connections,
  );
  assert.throws(
    () => hardwareDesign(nodes, [{ id: "bad", a: "1:missing", b: "2:SDA" }]),
    /未知引脚/,
  );
  await assert.rejects(() => compileHardware(nodes, connections.filter((c) => c.b !== "2:RST")), /电气检查未通过/);
});

test("firmware and virtual board follow changed GPIOs, SEL and motor polarity", () => {
  const nodes = completeProject([...starter, { id: 7, type: "motor", x: 0, y: 0 }]);
  const wires = referenceConnections(nodes).map((c) => {
    if (c.b === "2:SDA") return { ...c, a: "1:J3-8" };
    if (c.b === "2:RST") return { ...c, a: "1:J1-12" };
    if (c.b === "3:SEL") return { ...c, a: "1:J1-1" };
    if (c.b === "3:DOUT") return { ...c, a: "1:J3-5" };
    if (c.b === "8:M1") return { ...c, b: "8:M2" };
    if (c.b === "8:M2") return { ...c, b: "8:M1" };
    return c;
  });
  const result = firmwareProject({ nodes, connections: wires });
  assert.equal(result.spec.oled.sda, 40);
  assert.equal(result.spec.oled.reset, 8);
  assert.equal(result.spec.mic.data, 2);
  assert.equal(result.spec.mic.channel, 1);
  assert.equal(result.spec.motor.loads[0].polarity, -1);
  assert.equal(result.spec.motor.loads[1].polarity, 1);
  const shared = referenceConnections(starter).map((c) => c.b === "3:BCLK" ? { ...c, a: "1:J1-8" } : c.b === "3:WS" ? { ...c, a: "1:J1-9" } : c);
  assert.throws(() => firmwareProject({ nodes: starter, connections: shared }), /不支持共用/);
  assert.throws(() => firmwareProject({ nodes: starter, connections: shared.filter((c) => c.b !== "2:RST") }), /电气检查/);
});

test("firmware generation rejects malformed graphs and conflicting I2S routes", () => {
  const connections = referenceConnections(starter);
  for (const value of [null, {}, { nodes: [], connections: [] },
    { nodes: [...starter, starter[0]], connections },
    { nodes: starter, connections: [...connections, connections[0]] },
    { nodes: starter, connections: connections.map((c, i) => i ? c : { ...c, a: `${c.a}:alias` }) },
    { nodes: starter, connections: [{ id: "bad", a: "1:missing", b: "2:RST" }] }])
    assert.throws(() => firmwareProject(value));
  const oneClock = connections.map((c) => c.b === "3:BCLK" ? { ...c, a: "1:J1-8" } : c);
  assert.throws(() => firmwareProject({ nodes: starter, connections: oneClock }), /不支持共用/);
  const dataConflict = connections.map((c) => c.b === "3:DOUT" ? { ...c, a: "1:J1-7" } : c);
  assert.throws(() => firmwareProject({ nodes: starter, connections: dataConflict }), /争用/);
  const bare = completeProject([{ id: 1, type: "esp", x: 0, y: 0 }]);
  assert.equal(firmwareProject({ nodes: bare, connections: referenceConnections(bare) }).spec.oled, null);
});
