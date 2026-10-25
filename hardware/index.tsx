import { AudioOutput } from "./sections/AudioOutput"
import { Controller } from "./sections/Controller"
import { Display } from "./sections/Display"
import { Microphone } from "./sections/Microphone"
import { MotorDrive } from "./sections/MotorDrive"
import { PowerSupply } from "./sections/PowerSupply"
import { Launcher } from "./sections/Launcher"
import { Ultrasonic } from "./sections/Ultrasonic"

// 各功能区内聚接线和布局，入口只组合整张图纸。
export default function PaoWiring() {
  return (
    <board
      routingDisabled
      bomDisabled
      schLayout={{ layoutMode: "none" }}
      schMaxTraceDistance={12}
    >
      <schematicsheet
        name="Wiring"
        displayName="PAO ESP32-S3 模块接线图（参考）"
        sheetSize="A4"
      >
        <schematictext
          text="PAO / ESP32-S3 模块接线图"
          schX={2.5}
          schY={9.2}
          fontSize={0.35}
        />
        <Controller />
        <PowerSupply />
        <Microphone />
        <AudioOutput />
        <Display />
        <Ultrasonic />
        <MotorDrive />
        <Launcher />
      </schematicsheet>
    </board>
  )
}
