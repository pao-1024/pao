import type { ChipProps } from "@tscircuit/props"

// Seengreat 2-CH Relay HAT 外部端子；VIO 选择 3.3V，低电平吸合。
// https://seengreat.com/wiki/107/
const pins = {
  pin1: "VCC",
  pin2: "GND",
  pin3: "CH1",
  pin4: "CH2",
  pin5: "COM1",
  pin6: "NO1",
  pin7: "NC1",
  pin8: "COM2",
  pin9: "NO2",
  pin10: "NC2",
} as const

export function RelayDemoModule(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={1.8}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["VCC", "GND", "CH1", "CH2"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["COM1", "NO1", "NC1", "COM2", "NO2", "NC2"],
        },
      }}
    />
  )
}
