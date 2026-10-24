import type { ChipProps } from "@tscircuit/props"

// 电磁发射器：成品套件 HU-064，内部升压、储能与放电开关不在接线图展开。
// 对外只有三根线：3.3V 供电（通电即充能）、发射按钮输入、公共地。
// FIRE 与 GND 之间短接等同于按下发射键；该按键只驱动放电 MOS 的栅极，
// 放电电流不经过按键，因此继电器触点负载在毫安级。
// 储能 1000 µF/100 V，充到 90 V 约 4.05 J，空载充能约 10 s。
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
