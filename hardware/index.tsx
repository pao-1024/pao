import { Esp32S3DevKitC1 } from "./components/Esp32S3"
import { AudioOutput } from "./sections/AudioOutput"
import { Display } from "./sections/Display"
import { Microphone } from "./sections/Microphone"
import { MotorDrive } from "./sections/MotorDrive"
import { PowerSupply } from "./sections/PowerSupply"

// GPIO 在此集中分配，各功能区通过同名网络连接。
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
        <schematicsection name="Controller" displayName="02 ESP32-S3 主控" />
        <Esp32S3DevKitC1
          doNotPlace
          name="ESP32_S3"
          schSectionName="Controller"
          schX={-2}
          schY={0}
          connections={{
            "5V": "net.V5",
            "3V3": "net.V3V3",
            GND: "net.GND",
            GPIO4: "net.MIC_WS",
            GPIO5: "net.MIC_SCK",
            GPIO6: "net.MIC_SD",
            GPIO7: "net.AMP_DIN",
            GPIO15: "net.AMP_BCLK",
            GPIO16: "net.AMP_LRC",
            GPIO41: "net.OLED_SDA",
            GPIO42: "net.OLED_SCL",
            GPIO11: "net.MOTOR_IN1",
            GPIO12: "net.MOTOR_IN2",
            GPIO13: "net.MOTOR_IN3",
            GPIO14: "net.MOTOR_IN4",
          }}
        />

        <PowerSupply />
        <Microphone />
        <AudioOutput />
        <Display />
        <MotorDrive />
      </schematicsheet>
    </board>
  )
}
