import type { ReactElement } from "react"
import { Boost5VModule } from "./components/Boost5V"
import { Esp32S3DevKitC1 } from "./components/Esp32S3"
import { Inmp441Module } from "./components/Inmp441"
import { Max98357Module } from "./components/Max98357"
import { Mx1508Module } from "./components/Mx1508"
import { PowerSwitch } from "./components/PowerSwitch"
import { Tp4056Protection } from "./components/Tp4056"
import { OledModule } from "./components/Oled"

// 仅描述模块外部接线；引脚定义在组件中维护，排针位置见 README。
export default function PaoWiring(): ReactElement {
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
        <schematicsection name="Power" displayName="01 供电 / 1S → 5V" />
        <schematicsection name="Controller" displayName="02 ESP32-S3 主控" />
        <schematicsection name="Microphone" displayName="03 麦克风" />
        <schematicsection name="AudioOutput" displayName="04 功放与扬声器" />
        <schematicsection name="Display" displayName="05 OLED 屏幕" />
        <schematicsection name="Motors" displayName="06 MX1508 电机驱动" />

        <battery
          doNotPlace
          name="BATTERY"
          schSectionName="Power"
          schX={-11}
          schY={7}
          voltage="3.7V"
          schOrientation="pos_top"
          connections={{ pos: "CHARGER_1S.B_PLUS", neg: "CHARGER_1S.B_MINUS" }}
        />
        <Tp4056Protection
          doNotPlace
          name="CHARGER_1S"
          schSectionName="Power"
          noConnect={["USB_PLUS", "USB_MINUS"]}
          schX={-7}
          schY={7}
          connections={{
            OUT_PLUS: "POWER_SWITCH.COM",
            OUT_MINUS: "net.GND",
          }}
        />
        <netlabel
          net="GND"
          connection="CHARGER_1S.OUT_MINUS"
          schX={-5.2}
          schY={6.1}
          anchorSide="top"
        />
        <PowerSwitch
          doNotPlace
          name="POWER_SWITCH"
          schSectionName="Power"
          type="spdt"
          schX={-1.5}
          schY={7}
          pinLabels={{ pin1: "COM", pin2: "ON", pin3: "OFF" }}
          noConnect={["OFF"]}
          connections={{ ON: "BOOST_5V.VIN_PLUS" }}
        />
        <Boost5VModule
          doNotPlace
          name="BOOST_5V"
          schSectionName="Power"
          schX={3.5}
          schY={7}
          connections={{
            VIN_MINUS: "net.GND",
            VOUT_PLUS: "net.V5",
            VOUT_MINUS: "net.GND",
          }}
        />

        <netlabel
          net="GND"
          connection="BOOST_5V.VOUT_MINUS"
          schX={5.1}
          schY={6.1}
          anchorSide="top"
        />

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
        <Inmp441Module
          doNotPlace
          name="MIC"
          schSectionName="Microphone"
          schX={-11}
          schY={0}
          connections={{
            VDD: "net.V3V3",
            GND: "net.GND",
            L_R: "net.GND",
            WS: "net.MIC_WS",
            SCK: "net.MIC_SCK",
            SD: "net.MIC_SD",
          }}
        />
        <Max98357Module
          doNotPlace
          name="AMP"
          schSectionName="AudioOutput"
          schX={7.5}
          schY={3}
          connections={{
            VIN: "net.V3V3",
            GND: "net.GND",
            SD_MODE: "net.V3V3",
            GAIN: "net.GND",
            DIN: "net.AMP_DIN",
            BCLK: "net.AMP_BCLK",
            LRC: "net.AMP_LRC",
            OUT_PLUS: "SPEAKER.pos",
            OUT_MINUS: "SPEAKER.neg",
          }}
        />
        <netlabel
          net="V3V3"
          connection="AMP.VIN"
          schX={5.4}
          schY={4.3}
          anchorSide="bottom"
        />
        <schematicsymbol
          name="SPEAKER"
          symbolName="speaker_horz"
          schSectionName="AudioOutput"
          schX={12}
          schY={3}
        />
        <OledModule
          doNotPlace
          name="OLED"
          schSectionName="Display"
          schX={-11}
          schY={-3}
          connections={{
            SDA: "net.OLED_SDA",
            SCL: "net.OLED_SCL",
            VCC: "net.V3V3",
            GND: "net.GND",
          }}
        />

        <Mx1508Module
          doNotPlace
          name="MX1508"
          schSectionName="Motors"
          schX={6}
          schY={-6}
          connections={{
            VCC: "net.V5",
            GND: "net.GND",
            IN1: "net.MOTOR_IN1",
            IN2: "net.MOTOR_IN2",
            IN3: "net.MOTOR_IN3",
            IN4: "net.MOTOR_IN4",
            RIGHT_PLUS: "MOTOR_RIGHT.PLUS",
            RIGHT_MINUS: "MOTOR_RIGHT.MINUS",
            LEFT_PLUS: "MOTOR_LEFT.PLUS",
            LEFT_MINUS: "MOTOR_LEFT.MINUS",
          }}
        />
        <pinheader
          doNotPlace
          name="MOTOR_RIGHT"
          displayName="右侧电机"
          pinCount={2}
          pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
          schFacingDirection="left"
          schSectionName="Motors"
          schX={10.8}
          schY={-5.8}
        />
        <pinheader
          doNotPlace
          name="MOTOR_LEFT"
          displayName="左侧电机"
          pinCount={2}
          pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
          schFacingDirection="left"
          schSectionName="Motors"
          schX={15.2}
          schY={-6.2}
        />
      </schematicsheet>
    </board>
  )
}
