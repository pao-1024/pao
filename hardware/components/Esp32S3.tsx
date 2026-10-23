import type { ChipProps } from "@tscircuit/props"
import officialSymbol from "../vendor/espressif/ESP32-S3-DevKitC.kicad_sym"

// 转换器的缺省线宽会使边框和引脚过粗，统一为内置元件的线宽。
const symbol = officialSymbol.map((element) =>
  element.type === "schematic_line"
    ? { ...element, stroke_width: 0.02 }
    : element,
)

// 引脚编号、名称和图形来自乐鑫官方定义，仅补充便于接线的短别名。
const pinLabels = Object.fromEntries(
  symbol
    .filter((element) => element.type === "source_port")
    .map(({ pin_number, name }) => [`pin${pin_number}`, name.split("/")[0]]),
)

export function Esp32S3DevKitC1(props: ChipProps) {
  return <chip {...props} symbol={symbol} pinLabels={pinLabels} />
}
