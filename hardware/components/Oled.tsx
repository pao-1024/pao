import {
  Generic096InSSD1306OLEDI2CModule,
  type Generic096InSSD1306OLEDI2CModuleProps,
} from "@tscircuit/header-modules"
import { cloneElement, type ReactElement } from "react"

// 固定版本的上游组件返回原生 chip；复用全部定义，仅收紧绘图留白。
export function OledModule(
  props: Generic096InSSD1306OLEDI2CModuleProps,
): ReactElement {
  return cloneElement(Generic096InSSD1306OLEDI2CModule(props), {
    displayName: "SSD1306 OLED",
    schWidth: 1.7,
    schHeight: 0.6,
  })
}
