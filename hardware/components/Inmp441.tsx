import type { ChipProps } from "@tscircuit/props"
import type { ReactElement } from "react"

// INMP441 麦克风模块的外部接口，不展开内部电路。
const pins = {
  pin1: "VDD",
  pin2: "GND",
  pin3: "L_R",
  pin4: "WS",
  pin5: "SCK",
  pin6: "SD",
} as const

export function Inmp441Module(props: ChipProps<typeof pins>): ReactElement {
  return (
    <chip
      manufacturerPartNumber="INMP441"
      schWidth={1.35}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        rightSide: {
          direction: "top-to-bottom",
          pins: ["VDD", "GND", "L_R", "WS", "SCK", "SD"],
        },
      }}
    />
  )
}
