import { createElement } from "react";
import { pinSets, resolvePin, electricalReport } from "./circuit.ts";
import { partFor } from "./catalog.ts";
import type { Module, Connection } from "./catalog.ts";

export function hardwareDesign(nodes: Module[], connections: Connection[]) {
  return {
    modules: nodes.map((n, i) => ({
      name: `U${n.id}`,
      displayName: partFor(n.type).name,
      pinLabels: Object.fromEntries(
        pinSets[n.type].map((p, j) => [`pin${j + 1}`, p.name]),
      ),
      schX: (i % 3) * 12,
      schY: -Math.floor(i / 3) * 18,
      schWidth: 4,
      schHeight: Math.max(2, pinSets[n.type].length * 0.15),
    })),
    connections: connections.map((c) =>
      [c.a, c.b].map((key) => {
        const p = resolvePin(nodes, key);
        if (!p) throw Error("连接包含未知引脚");
        const index = pinSets[p.node.type as Module["type"]].findIndex(
          (pin) => pin.id === p.pin.id,
        );
        return `.U${p.node.id} > .pin${index + 1}`;
      }),
    ),
  };
}

export function hardwareSource(nodes: Module[], connections: Connection[]) {
  const design = hardwareDesign(nodes, connections);
  return `// tscircuit 模块接口原理图；真实 PCB 封装、铜线及制造文件由同一接线的制造包导出。\nexport default function Design() {\n  return (\n    <board pcbDisabled routingDisabled schLayout={{layoutMode: "none"}}>\n${design.modules.map((m) => `      <chip {...${JSON.stringify(m)}} />`).join("\n")}\n${design.connections.map(([from, to]) => `      <trace from=${JSON.stringify(from)} to=${JSON.stringify(to)} />`).join("\n")}\n    </board>\n  );\n}\n`;
}

export async function compileHardware(
  nodes: Module[],
  connections: Connection[],
) {
  const electrical = electricalReport(nodes, connections);
  if (electrical.issues.length) throw Error(`电气检查未通过：${electrical.issues.join("；")}`);
  const [{ Circuit }, { convertCircuitJsonToSchematicSvg }] = await Promise.all(
    [import("@tscircuit/core"), import("circuit-to-svg")],
  );
  const design = hardwareDesign(nodes, connections);
  const circuit = new Circuit({
    platform: { pcbDisabled: true, partsEngineDisabled: true },
  });
  circuit.add(
    createElement(
      "board",
      {
        pcbDisabled: true,
        routingDisabled: true,
        schLayout: { layoutMode: "none" },
      },
      ...design.modules.map((m) => createElement("chip", m)),
      ...design.connections.map(([from, to]) =>
        createElement("trace", { from, to }),
      ),
    ),
  );
  await circuit.renderUntilSettled();
  const json = circuit.getCircuitJson();
  const errors = json.filter((e) => e.type.includes("error"));
  if (errors.length) throw Error(JSON.stringify(errors));
  return { json, svg: convertCircuitJsonToSchematicSvg(json) };
}
