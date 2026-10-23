import type { ReactElement } from "react"

// 只描述用户接线图中的模块外部接口；pin1 等是符号索引，不是实物排针编号。
export default function PaoWiring(): ReactElement {
  return (
    <board routingDisabled bomDisabled>
      <schematictext
        text="PAO - ESP32-S3 module wiring (reference)"
        schX={0}
        schY={10}
        fontSize={0.5}
      />

      <chip
        doNotPlace
        name="BATTERY"
        schX={-10}
        schY={7}
        schWidth={2.5}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        schPinArrangement={{
          rightSide: { direction: "top-to-bottom", pins: ["PLUS", "MINUS"] },
        }}
        connections={{ PLUS: "net.BAT_POS", MINUS: "net.BAT_NEG" }}
      />
      <chip
        doNotPlace
        name="CHARGER_1S"
        schX={-5}
        schY={7}
        schWidth={3.5}
        pinLabels={{
          pin1: "B_PLUS",
          pin2: "B_MINUS",
          pin3: "OUT_PLUS",
          pin4: "OUT_MINUS",
        }}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: ["B_PLUS", "B_MINUS"] },
          rightSide: {
            direction: "top-to-bottom",
            pins: ["OUT_PLUS", "OUT_MINUS"],
          },
        }}
        connections={{
          B_PLUS: "net.BAT_POS",
          B_MINUS: "net.BAT_NEG",
          OUT_PLUS: "net.VBAT_PROTECTED",
          OUT_MINUS: "net.GND",
        }}
      />
      <chip
        doNotPlace
        name="POWER_SWITCH"
        schX={0}
        schY={7}
        schWidth={2.5}
        pinLabels={{ pin1: "COM", pin2: "ON", pin3: "OFF" }}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: ["COM"] },
          rightSide: { direction: "top-to-bottom", pins: ["ON", "OFF"] },
        }}
        noConnect={["OFF"]}
        connections={{ COM: "net.VBAT_PROTECTED", ON: "net.VBAT_SWITCHED" }}
      />
      <chip
        doNotPlace
        name="BOOST_5V"
        schX={5}
        schY={7}
        schWidth={3.5}
        pinLabels={{
          pin1: "VIN_PLUS",
          pin2: "VIN_MINUS",
          pin3: "VOUT_PLUS",
          pin4: "VOUT_MINUS",
        }}
        schPinArrangement={{
          leftSide: {
            direction: "top-to-bottom",
            pins: ["VIN_PLUS", "VIN_MINUS"],
          },
          rightSide: {
            direction: "top-to-bottom",
            pins: ["VOUT_PLUS", "VOUT_MINUS"],
          },
        }}
        connections={{
          VIN_PLUS: "net.VBAT_SWITCHED",
          VIN_MINUS: "net.GND",
          VOUT_PLUS: "net.V5",
          VOUT_MINUS: "net.GND",
        }}
      />

      <chip
        doNotPlace
        name="ESP32_S3"
        schX={0}
        schY={0}
        schWidth={3.5}
        pinLabels={{
          pin1: "V5",
          pin2: "V3V3",
          pin3: "GND",
          pin4: "GPIO4",
          pin5: "GPIO5",
          pin6: "GPIO6",
          pin7: "GPIO7",
          pin8: "GPIO15",
          pin9: "GPIO16",
          pin10: "GPIO11",
          pin11: "GPIO12",
          pin12: "GPIO13",
          pin13: "GPIO14",
          pin14: "GPIO41",
          pin15: "GPIO42",
        }}
        schPinArrangement={{
          leftSide: {
            direction: "top-to-bottom",
            pins: ["V5", "V3V3", "GND", "GPIO4", "GPIO5", "GPIO6"],
          },
          rightSide: {
            direction: "top-to-bottom",
            pins: [
              "GPIO7",
              "GPIO15",
              "GPIO16",
              "GPIO41",
              "GPIO42",
              "GPIO11",
              "GPIO12",
              "GPIO13",
              "GPIO14",
            ],
          },
        }}
        connections={{
          V5: "net.V5",
          V3V3: "net.V3V3",
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

      <chip
        doNotPlace
        name="MIC"
        manufacturerPartNumber="INMP441"
        schX={-8}
        schY={0}
        schWidth={2.5}
        pinLabels={{
          pin1: "VDD",
          pin2: "GND",
          pin3: "L_R",
          pin4: "WS",
          pin5: "SCK",
          pin6: "SD",
        }}
        schPinArrangement={{
          rightSide: {
            direction: "top-to-bottom",
            pins: ["VDD", "GND", "L_R", "WS", "SCK", "SD"],
          },
        }}
        connections={{
          VDD: "net.V3V3",
          GND: "net.GND",
          L_R: "net.GND",
          WS: "net.MIC_WS",
          SCK: "net.MIC_SCK",
          SD: "net.MIC_SD",
        }}
      />

      <chip
        doNotPlace
        name="AMP"
        manufacturerPartNumber="MAX98357A"
        schX={6}
        schY={3}
        schWidth={2.5}
        pinLabels={{
          pin1: "VIN",
          pin2: "GND",
          pin3: "SD_MODE",
          pin4: "GAIN",
          pin5: "DIN",
          pin6: "BCLK",
          pin7: "LRC",
          pin8: "OUT_PLUS",
          pin9: "OUT_MINUS",
        }}
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
        connections={{
          VIN: "net.V3V3",
          GND: "net.GND",
          SD_MODE: "net.V3V3",
          GAIN: "net.GND",
          DIN: "net.AMP_DIN",
          BCLK: "net.AMP_BCLK",
          LRC: "net.AMP_LRC",
          OUT_PLUS: "net.SPK_PLUS",
          OUT_MINUS: "net.SPK_MINUS",
        }}
      />
      <netlabel
        net="V3V3"
        connection="AMP.VIN"
        schX={3.9}
        schY={4.3}
        anchorSide="bottom"
      />
      <chip
        doNotPlace
        name="SPEAKER"
        schX={12}
        schY={3}
        schWidth={2.5}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: ["PLUS", "MINUS"] },
        }}
        connections={{ PLUS: "net.SPK_PLUS", MINUS: "net.SPK_MINUS" }}
      />

      <chip
        doNotPlace
        name="OLED"
        manufacturerPartNumber="SSD1306 128x64"
        schX={6}
        schY={-1.5}
        schWidth={2.5}
        pinLabels={{ pin1: "SDA", pin2: "SCL", pin3: "VCC", pin4: "GND" }}
        schPinArrangement={{
          leftSide: {
            direction: "top-to-bottom",
            pins: ["SDA", "SCL", "VCC", "GND"],
          },
        }}
        connections={{
          SDA: "net.OLED_SDA",
          SCL: "net.OLED_SCL",
          VCC: "net.V3V3",
          GND: "net.GND",
        }}
      />

      {/* 原图标注 L298N 小红板；只建模该四输入模块，不假定具体驱动 IC。 */}
      <chip
        doNotPlace
        name="MOTOR_DRIVER"
        schX={6}
        schY={-6}
        schWidth={3.5}
        pinLabels={{
          pin1: "VCC",
          pin2: "GND",
          pin3: "IN1",
          pin4: "IN2",
          pin5: "IN3",
          pin6: "IN4",
          pin7: "RIGHT_PLUS",
          pin8: "RIGHT_MINUS",
          pin9: "LEFT_PLUS",
          pin10: "LEFT_MINUS",
        }}
        schPinArrangement={{
          leftSide: {
            direction: "top-to-bottom",
            pins: ["VCC", "GND", "IN1", "IN2", "IN3", "IN4"],
          },
          rightSide: {
            direction: "top-to-bottom",
            pins: ["RIGHT_PLUS", "RIGHT_MINUS", "LEFT_PLUS", "LEFT_MINUS"],
          },
        }}
        connections={{
          VCC: "net.V5",
          GND: "net.GND",
          IN1: "net.MOTOR_IN1",
          IN2: "net.MOTOR_IN2",
          IN3: "net.MOTOR_IN3",
          IN4: "net.MOTOR_IN4",
          RIGHT_PLUS: "net.MOTOR_RIGHT_PLUS",
          RIGHT_MINUS: "net.MOTOR_RIGHT_MINUS",
          LEFT_PLUS: "net.MOTOR_LEFT_PLUS",
          LEFT_MINUS: "net.MOTOR_LEFT_MINUS",
        }}
      />
      <chip
        doNotPlace
        name="MOTOR_RIGHT"
        schX={12}
        schY={-5}
        schWidth={2.5}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: ["PLUS", "MINUS"] },
        }}
        connections={{
          PLUS: "net.MOTOR_RIGHT_PLUS",
          MINUS: "net.MOTOR_RIGHT_MINUS",
        }}
      />
      <chip
        doNotPlace
        name="MOTOR_LEFT"
        schX={12}
        schY={-7.5}
        schWidth={2.5}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: ["PLUS", "MINUS"] },
        }}
        connections={{
          PLUS: "net.MOTOR_LEFT_PLUS",
          MINUS: "net.MOTOR_LEFT_MINUS",
        }}
      />
    </board>
  )
}
