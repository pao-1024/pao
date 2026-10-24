import type { ChipProps } from "@tscircuit/props"

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

export function Max98357Module(props: ChipProps<typeof pins>) {
  return (
    <chip
      manufacturerPartNumber="MAX98357A"
      schWidth={2.4}
      {...props}
      pinLabels={pins}
      schPinStyle={{
        SD_MODE: { marginLeft: 0.8 },
        GAIN: { marginLeft: 0.8 },
      }}
      schPinArrangement={{
        topSide: {
          direction: "left-to-right",
          pins: ["VIN", "SD_MODE"],
        },
        leftSide: {
          direction: "top-to-bottom",
          pins: ["DIN", "BCLK", "LRC"],
        },
        bottomSide: {
          direction: "left-to-right",
          pins: ["GND", "GAIN"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["OUT_PLUS", "OUT_MINUS"],
        },
      }}
    />
  )
}
