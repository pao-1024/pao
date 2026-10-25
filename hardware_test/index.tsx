import { Controller } from "./sections/Controller"
import { Audio } from "./sections/Audio"
import { Motors } from "./sections/Motors"
import { UsbStatusRf } from "./sections/UsbStatusRf"
import { Power } from "./sections/Power"
import { Display } from "./sections/Display"
import { Ultrasonic } from "./sections/Ultrasonic"

export default function PaoBoard() {
  return (
    <board
      width="120mm"
      height="90mm"
      layers={4}
      minViaEdgeToPadEdgeClearance="0.2mm"
      routeRemaining={true}
      schAutoLayoutEnabled
    >
      <hole name="H_M3_NW" diameter="3.2mm" pcbX={-55} pcbY={40} />
      <hole name="H_M3_NE" diameter="3.2mm" pcbX={55} pcbY={40} />
      <hole name="H_M3_SW" diameter="3.2mm" pcbX={-55} pcbY={-40} />
      <hole name="H_M3_SE" diameter="3.2mm" pcbX={55} pcbY={-40} />
      <copperpour
        name="GND_PLANE"
        connectsTo="net.GND"
        layer="inner1"
        clearance="0.2mm"
        boardEdgeMargin="0.5mm"
      />
      <schematicsheet name="Controller" displayName="主控与存储" sheetSize="A4">
        <Controller />
      </schematicsheet>
      <schematicsheet name="Power" displayName="电池与电源" sheetSize="A4">
        <Power />
      </schematicsheet>
      <schematicsheet name="Motors" displayName="双路电机" sheetSize="A4">
        <Motors />
      </schematicsheet>
      <schematicsheet name="Audio" displayName="音频输入与输出" sheetSize="A4">
        <Audio />
      </schematicsheet>
      <schematicsheet name="Display" displayName="OLED 显示" sheetSize="A4">
        <Display />
      </schematicsheet>
      <schematicsheet
        name="UsbRf"
        displayName="USB、状态灯与天线"
        sheetSize="A4"
      >
        <UsbStatusRf />
      </schematicsheet>
      <schematicsheet
        name="Ultrasonic"
        displayName="超声波模组接口"
        sheetSize="A4"
      >
        <Ultrasonic />
      </schematicsheet>
    </board>
  )
}
