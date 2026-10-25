import test from "node:test";
import assert from "node:assert/strict";
import { compileHardware, hardwareDesign } from "./src/hardware.ts";
import { referenceConnections } from "./src/circuit.ts";

test("tscircuit renders the selected modules and current pin connections", async () => {
  const nodes = [
    { id: 1, type: "esp", x: 0, y: 0 },
    { id: 2, type: "oled", x: 400, y: 0 },
  ];
  const connections = referenceConnections(nodes);
  const result = await compileHardware(nodes, connections);
  assert.match(result.svg, /<svg/);
  const components = result.json.filter((e) => e.type === "source_component");
  assert.deepEqual(components.map((c) => c.name).sort(), ["U1", "U2"]);
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
});
