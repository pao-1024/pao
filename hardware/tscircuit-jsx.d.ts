// 复用上游属性类型，避免 tscircuit 聚合入口连带检查路由器的第三方 TS 源码。
import type {
  BoardProps,
  ChipProps,
  NetLabelProps,
  SchematicTextProps,
} from "@tscircuit/props"
import "react/jsx-runtime"

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      board: BoardProps
      chip: ChipProps
      netlabel: NetLabelProps
      schematictext: SchematicTextProps
    }
  }
}
