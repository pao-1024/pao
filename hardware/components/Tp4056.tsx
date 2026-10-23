import type { ChipProps } from "@tscircuit/props"

// 从 vendor/tp4056/TP4056.fzpz 的 connector/description 转换；保留 connector0..5 的顺序。
const pins = {
  pin1: "USB_PLUS",
  pin2: "USB_MINUS",
  pin3: "OUT_PLUS",
  pin4: "B_PLUS",
  pin5: "B_MINUS",
  pin6: "OUT_MINUS",
} as const

export function Tp4056Protection(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={2.2}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: {
          direction: "top-to-bottom",
          pins: ["USB_PLUS", "USB_MINUS", "B_PLUS", "B_MINUS"],
        },
        rightSide: {
          direction: "top-to-bottom",
          pins: ["OUT_PLUS", "OUT_MINUS"],
        },
      }}
    />
  )
}
