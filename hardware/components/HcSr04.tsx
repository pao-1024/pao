import type { ChipProps } from "@tscircuit/props"

// 仅适用于明确支持 3.3V 供电及信号电平的 HC-SR04 模块。
const pins = {
  pin1: "VCC",
  pin2: "TRIG",
  pin3: "ECHO",
  pin4: "GND",
} as const

export function HcSr04Module(props: ChipProps<typeof pins>) {
  return (
    <chip
      manufacturerPartNumber="HC-SR04 (3.3V)"
      schWidth={1.35}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        rightSide: {
          direction: "top-to-bottom",
          pins: ["VCC", "TRIG", "ECHO", "GND"],
        },
      }}
    />
  )
}
