import type { ChipProps } from "@tscircuit/props"

// 电磁发射器整体视为黑盒模块，内部升压、储能与放电开关不在接线图展开。
// 对外只有三根线：3.3V 供电（通电即充能）、发射按钮输入、公共地。
// FIRE 与 GND 之间短接等同于按下发射键，由发射继电器切换。
const pins = {
  pin1: "VCC",
  pin2: "GND",
  pin3: "FIRE",
} as const

export function LauncherModule(props: ChipProps<typeof pins>) {
  return (
    <chip
      schWidth={2.2}
      {...props}
      pinLabels={pins}
      schPinArrangement={{
        leftSide: { direction: "top-to-bottom", pins: ["VCC", "GND", "FIRE"] },
      }}
    />
  )
}
