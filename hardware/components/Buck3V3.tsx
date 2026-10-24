import type { ChipProps } from "@tscircuit/props"

// 发射器专用 5V → 3.3V 降压模块，四端子接口参考 MP1584 类小板。
// 单独供电的目的：把继电器线圈与发射器充能的脉冲电流从主控 3V3 上移走，
// 避免拉塌开发板稳压器并污染麦克风、功放的供电。
const pins = {
  pin1: "VIN_PLUS",
  pin2: "VIN_MINUS",
  pin3: "VOUT_MINUS",
  pin4: "VOUT_PLUS",
} as const

export function Buck3V3Module(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={2.2}
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
