import { autoRoute } from "./circuit.ts";
import type { Module, Connection, Trace } from "./catalog.ts";

self.onmessage = (event: MessageEvent<{ nodes: Module[]; connections: Connection[]; traces: Trace[]; board: { width: number; height: number }; width: number }>) => {
  try {
    const { nodes, connections, traces, board, width } = event.data;
    self.postMessage({ result: autoRoute(nodes, connections, traces, board, width) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
