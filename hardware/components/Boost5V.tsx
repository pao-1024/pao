import type { ChipProps } from "@tscircuit/props"

// 从 MT3608 KiCad 定义转换；保留针脚编号，修正 pin4 的 VOUT- 笔误，来源见 vendor/README.md。
// 仅复用 MT3608 板级四端子接口作为 5V 升压参考，实际模块型号尚未确认。
const pins = {
  pin1: "VIN_PLUS",
  pin2: "VIN_MINUS",
  pin3: "VOUT_MINUS",
  pin4: "VOUT_PLUS",
} as const

export function Boost5VModule(props: ChipProps<typeof pins>) {
  return (
    <chip
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["VIN_PLUS", "VIN_MINUS"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["VOUT_PLUS", "VOUT_MINUS"],
        },
      }}
    />
  )
}
