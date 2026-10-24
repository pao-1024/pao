import type { ChipProps } from "@tscircuit/props"

// 3.3V 单路继电器模块端子；VCC/GND 对应丝印 DC+/DC−。
// 模块内含线圈驱动及续流保护，触发跳帽设在 L 档（低电平吸合）。
// 左侧为供电与触发，右侧为触点，与常规单路继电器板的丝印分组一致。
const pins = {
  pin1: "VCC",
  pin2: "GND",
  pin3: "IN",
  pin4: "NO",
  pin5: "COM",
  pin6: "NC",
} as const

export function RelayModule(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={1.6}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["VCC", "GND", "IN"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["NO", "COM", "NC"],
        },
      }}
    />
  )
}
