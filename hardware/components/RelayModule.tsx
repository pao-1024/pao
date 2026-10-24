import type { ChipProps } from "@tscircuit/props"

// 3.3V 单路继电器模块端子；VCC/GND 对应丝印 DC+/DC−。
// 模块内含线圈驱动及续流保护，触发跳帽设在 L 档（低电平吸合）。
// 供电侧（VCC/COM/GND）与触点侧（NO/NC）分列左右，避免同一网络跨接元件两端。
const pins = {
  pin1: "VCC",
  pin2: "COM",
  pin3: "GND",
  pin4: "IN",
  pin5: "NO",
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
          pins: ["VCC", "COM", "GND", "IN"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["NO", "NC"],
        },
      }}
    />
  )
}
