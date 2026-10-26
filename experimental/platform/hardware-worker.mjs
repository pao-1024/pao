import { parentPort, workerData } from "node:worker_threads";
import { autoRoute, boardIssues } from "./src/circuit.ts";
import { compileHardware, hardwareSource } from "./src/hardware.ts";
import { manufacturingFiles } from "./src/manufacturing.ts";

try {
  const { nodes, connections, board } = workerData;
  parentPort.postMessage({ phase: "routing" });
  const routed = autoRoute(nodes, connections, [], board);
  const issues = [...routed.issues, ...boardIssues(nodes, connections, routed.traces, board)];
  if (routed.failed.length || issues.length) throw Error(`PCB 未通过：${routed.failed.length} 根未布通 ${routed.failed.map((c) => c.id).join(", ")}；${issues.join("；")}`);
  const manufacturing = manufacturingFiles(nodes, connections, routed.traces, board);
  parentPort.postMessage({ phase: "schematic" });
  const schematic = await compileHardware(nodes, connections);
  parentPort.postMessage({ result: { ...workerData, traces: routed.traces, manufacturing, schematic, source: hardwareSource(nodes, connections) } });
} catch (error) { parentPort.postMessage({ error: String(error) }); }
