import type { ChipProps } from "@tscircuit/props"

// 3.3V 单路继电器模块端子；VCC/GND 对应丝印 DC+/DC−。
// 模块须包含线圈驱动及续流保护，高/低电平跳帽设为低电平触发。
const pins = {
  pin1: "VCC",
  pin2: "GND",
  pin3: "IN",
  pin4: "COM",
  pin5: "NO",
  pin6: "NC",
} as const

export function RelayDemoModule(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={1.7}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["VCC", "GND", "IN"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["COM", "NO", "NC"],
        },
      }}
    />
  )
}
