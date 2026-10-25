import { compileHardware } from "./hardware.ts";
import type { Module, Connection } from "./catalog.ts";

self.onmessage = async (
  event: MessageEvent<{ nodes: Module[]; connections: Connection[] }>,
) => {
  try {
    self.postMessage({
      result: await compileHardware(event.data.nodes, event.data.connections),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
