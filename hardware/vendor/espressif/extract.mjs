// 在 hardware/ 下运行：node vendor/espressif/extract.mjs
// 使用 tscircuit 同一依赖树中的 kicadts 解析和序列化，不手工重建引脚。
import { writeFile } from "node:fs/promises"
import { KicadSymbolLib, parseKicadSym, Pts, SymbolPolyline, Xy } from "kicadts"

const revision = "dd76561812ab300351234ba6e0ec1295641796f0"
const upstream = `https://raw.githubusercontent.com/espressif/kicad-libraries/${revision}`

async function download(path) {
  const response = await fetch(`${upstream}/${path}`)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.text()
}

const library = parseKicadSym(await download("symbols/Espressif.kicad_sym"))
const symbol = library.symbols.find(
  (candidate) =>
    (candidate.libraryId ?? candidate.libraryName) === "ESP32-S3-DevKitC",
)
if (!symbol) throw new Error("官方库中没有 ESP32-S3-DevKitC")

// 原生符号使用 {REF} 动态显示实例名；只适配文本，不修改几何或引脚。
const reference = symbol.properties.find(
  (property) => property.key === "Reference",
)
if (!reference) throw new Error("官方符号没有 Reference 属性")
reference.value = "{REF}"

// 转换器将背景矩形只用于边界计算；补充等价闭环，让原生导入也绘制边框。
function preserveBodyOutline(part) {
  for (const rectangle of part.rectangles) {
    const children = rectangle.getChildren()
    const start = children.find((child) => child.token === "start")
    const end = children.find((child) => child.token === "end")
    const fill = children.find((child) => child.token === "fill")
    if (fill?.type !== "background" || !start || !end) continue
    part.polylines.push(
      new SymbolPolyline({
        points: new Pts([
          new Xy(start.x, start.y),
          new Xy(end.x, start.y),
          new Xy(end.x, end.y),
          new Xy(start.x, end.y),
          new Xy(start.x, start.y),
        ]),
        stroke: children.find((child) => child.token === "stroke"),
        fill,
      }),
    )
  }
  part.subSymbols.forEach(preserveBodyOutline)
}
preserveBodyOutline(symbol)

const selected = new KicadSymbolLib({
  version: library.version,
  generator: library.generator,
  generatorVersion: library.generatorVersion,
  symbols: [symbol],
})
await writeFile(
  new URL("./ESP32-S3-DevKitC.kicad_sym", import.meta.url),
  `${selected.getStringIndented()}\n`,
)
await writeFile(
  new URL("./LICENSE.md", import.meta.url),
  await download("LICENSE.md"),
)
