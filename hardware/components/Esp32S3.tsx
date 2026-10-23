import type { ChipProps } from "@tscircuit/props"
import type { ReactElement } from "react"
import officialSymbol from "../vendor/espressif/ESP32-S3-DevKitC.kicad_sym"

// 与内置模块采用一致的线宽，保持官方符号的坐标和文字。
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

export function Esp32S3DevKitC1(props: ChipProps): ReactElement {
  return <chip {...props} symbol={symbol} pinLabels={pinLabels} />
}
