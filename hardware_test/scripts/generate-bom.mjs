import { readFileSync, writeFileSync } from "node:fs"

const circuit = JSON.parse(
  readFileSync(new URL("../dist/index/circuit.json", import.meta.url)),
)
const components = circuit.filter((item) => item.type === "source_component")
const pcbComponents = new Map(
  circuit
    .filter((item) => item.type === "pcb_component")
    .map((item) => [item.source_component_id, item]),
)
const groups = new Map()
const packageBySize = {
  "1.12x0.4": "0201",
  "1.56x0.64": "0402",
  "2.45x0.95": "0603",
  "2.85x1.4": "0805",
  "4.05x1.75": "1206",
}

for (const item of components) {
  const value =
    item.display_resistance ??
    item.display_capacitance ??
    item.display_inductance ??
    ""
  const part = item.manufacturer_part_number ?? ""
  const pcb = pcbComponents.get(item.source_component_id)
  const size = pcb
    ? [pcb.width, pcb.height]
        .map((v) => Number(v.toFixed(2)))
        .sort((a, b) => b - a)
        .join("x")
    : ""
  const footprint = packageBySize[size] ?? ""
  const key = [item.ftype, value, footprint, part].join("|")
  const group = groups.get(key) ?? {
    kind: item.ftype,
    value,
    footprint,
    part,
    references: [],
  }
  group.references.push(item.name)
  groups.set(key, group)
}

const cell = (value) => `"${String(value).replaceAll('"', '""')}"`
const rows = [["数量", "位号", "类别", "标称值", "封装", "制造商料号"]]
for (const group of [...groups.values()].sort(
  (a, b) => a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value),
)) {
  rows.push([
    group.references.length,
    group.references.join(" "),
    group.kind,
    group.value,
    group.footprint,
    group.part,
  ])
}
writeFileSync(
  new URL("../BOM.csv", import.meta.url),
  rows.map((row) => row.map(cell).join(",")).join("\n") + "\n",
)
