import type { ChipProps } from "@tscircuit/props"
import type { ReactElement } from "react"

// MAX98357A 功放模块的外部接口，不展开内部电路。
const pins = {
  pin1: "VIN",
  pin2: "GND",
  pin3: "SD_MODE",
  pin4: "GAIN",
  pin5: "DIN",
  pin6: "BCLK",
  pin7: "LRC",
  pin8: "OUT_PLUS",
  pin9: "OUT_MINUS",
} as const

export function Max98357Module(props: ChipProps<typeof pins>): ReactElement {
  return (
    <chip
      manufacturerPartNumber="MAX98357A"
      schWidth={2.5}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["VIN", "GND", "SD_MODE", "GAIN", "DIN", "BCLK", "LRC"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["OUT_PLUS", "OUT_MINUS"],
        },
      }}
    />
  )
}
