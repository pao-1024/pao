import type { SwitchProps } from "@tscircuit/props"
import { createElement, type ReactElement } from "react"

// React 的同名 JSX 标签属于 SVG，通过 createElement 使用 tscircuit 内置开关。
export function PowerSwitch(props: SwitchProps): ReactElement {
  return createElement("switch", props)
}
