import type { ChipProps } from "@tscircuit/props"

// MX1508 双路电机驱动模块的外部端子，不展开内部电路。
const pins = {
  pin1: "VCC",
  pin2: "GND",
  pin3: "IN1",
  pin4: "IN2",
  pin5: "IN3",
  pin6: "IN4",
  pin7: "RIGHT_PLUS",
  pin8: "RIGHT_MINUS",
  pin9: "LEFT_PLUS",
  pin10: "LEFT_MINUS",
} as const

export function Mx1508Module(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={2.5}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["VCC", "GND", "IN1", "IN2", "IN3", "IN4"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["RIGHT_PLUS", "RIGHT_MINUS", "LEFT_PLUS", "LEFT_MINUS"],
        },
      }}
    />
  )
}
