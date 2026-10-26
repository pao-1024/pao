import { esp32S3R8Footprint } from "../imports/ESP32_S3R8"

// 裸 ESP32-S3R8 + 外置 16 MB Flash；GPIO 保持原接线图的固件分配。
const pins = {
  pin1: "LNA_IN",
  pin2: "VDD3P3_A",
  pin3: "VDD3P3_B",
  pin4: "CHIP_PU",
  pin5: "GPIO0",
  pin6: "GPIO1",
  pin7: "GPIO2",
  pin8: "GPIO3",
  pin9: "GPIO4",
  pin10: "GPIO5",
  pin11: "GPIO6",
  pin12: "GPIO7",
  pin13: "GPIO8",
  pin14: "GPIO9",
  pin15: "GPIO10",
  pin16: "GPIO11",
  pin17: "GPIO12",
  pin18: "GPIO13",
  pin19: "GPIO14",
  pin20: "VDD3P3_RTC",
  pin21: "GPIO15",
  pin22: "GPIO16",
  pin23: "GPIO17",
  pin24: "GPIO18",
  pin25: "GPIO19",
  pin26: "GPIO20",
  pin27: "GPIO21",
  pin28: "SPICS1",
  pin29: "VDD_SPI",
  pin30: "SPIHD",
  pin31: "SPIWP",
  pin32: "SPICS0",
  pin33: "SPICLK",
  pin34: "SPIQ",
  pin35: "SPID",
  pin36: "GPIO48",
  pin37: "GPIO47",
  pin38: "GPIO33",
  pin39: "GPIO34",
  pin40: "GPIO35",
  pin41: "GPIO36",
  pin42: "GPIO37",
  pin43: "GPIO38",
  pin44: "GPIO39",
  pin45: "GPIO40",
  pin46: "VDD3P3_CPU",
  pin47: "GPIO41",
  pin48: "GPIO42",
  pin49: "GPIO43",
  pin50: "GPIO44",
  pin51: "GPIO45",
  pin52: "GPIO46",
  pin53: "XTAL_N",
  pin54: "XTAL_P",
  pin55: "VDDA_A",
  pin56: "VDDA_B",
  pin57: "GND_EP",
} as const

const buttonFootprint = (
  <footprint>
    <smtpad
      shape="rect"
      portHints={["pin1"]}
      pcbX={1.3}
      pcbY={0}
      width="1.6mm"
      height="1.7mm"
    />
    <smtpad
      shape="rect"
      portHints={["pin2"]}
      pcbX={-1.3}
      pcbY={0}
      width="1.6mm"
      height="1.7mm"
    />
  </footprint>
)

export function Controller() {
  return (
    <>
      <schematicsection name="Controller" displayName="ESP32-S3R8 与 Flash" />
      <chip
        name="U_MCU"
        manufacturerPartNumber="ESP32-S3R8"
        supplierPartNumbers={{ jlcpcb: ["C2913194"] }}
        footprint={esp32S3R8Footprint}
        pinLabels={pins}
        pcbX={0}
        pcbY={6}
        schX={0}
        schY={0}
        schSectionName="Controller"
        connections={{
          VDD3P3_A: "net.V3V3",
          VDD3P3_B: "net.V3V3",
          VDD3P3_RTC: "net.V3V3",
          VDD3P3_CPU: "net.V3V3",
          VDDA_A: "net.V3V3",
          VDDA_B: "net.V3V3",
          GND_EP: "net.GND",
          CHIP_PU: "net.EN",
          GPIO0: "net.BOOT",
          GPIO48: "net.RGB_DATA",
          GPIO4: "net.MIC_WS",
          GPIO5: "net.MIC_SCK",
          GPIO6: "net.MIC_SD",
          GPIO7: "net.AMP_DIN",
          GPIO15: "net.AMP_BCLK",
          GPIO16: "net.AMP_LRC",
          GPIO11: "net.MOTOR_IN1",
          GPIO12: "net.MOTOR_IN2",
          GPIO13: "net.MOTOR_IN3",
          GPIO14: "net.MOTOR_IN4",
          GPIO19: "net.USB_DM",
          GPIO20: "net.USB_DP",
          GPIO8: "net.US_TRIG",
          GPIO9: "net.US_ECHO",
          GPIO41: "net.OLED_SDA",
          GPIO42: "net.OLED_SCL",
          LNA_IN: "net.RF_IN",
          XTAL_P: "net.XTAL_P",
          XTAL_N: "net.XTAL_N",
          VDD_SPI: "net.VDD_SPI",
          SPICS0: "net.FLASH_CS",
          SPICLK: "net.FLASH_CLK",
          SPIQ: "net.FLASH_IO1",
          SPID: "net.FLASH_IO0",
          SPIWP: "net.FLASH_IO2",
          SPIHD: "net.FLASH_IO3",
        }}
      />
      <chip
        name="U_FLASH"
        manufacturerPartNumber="W25Q128JVSIQ"
        footprint="soic8_w5.3mm_p1.27mm"
        pinLabels={{
          pin1: "CS",
          pin2: "IO1",
          pin3: "IO2",
          pin4: "GND",
          pin5: "IO0",
          pin6: "CLK",
          pin7: "IO3",
          pin8: "VCC",
        }}
        pcbX={10}
        pcbY={-2}
        schX={13}
        schY={0}
        schSectionName="Controller"
        connections={{
          CS: "net.FLASH_CS",
          IO1: "net.FLASH_IO1",
          IO2: "net.FLASH_IO2",
          GND: "net.GND",
          IO0: "net.FLASH_IO0",
          CLK: "net.FLASH_CLK",
          IO3: "net.FLASH_IO3",
          VCC: "net.VDD_SPI",
        }}
      />
      <capacitor
        name="C_FLASH"
        capacitance="100nF"
        footprint="0402"
        pcbX={15}
        pcbY={-2}
        schSectionName="Controller"
        connections={{ pin1: "net.VDD_SPI", pin2: "net.GND" }}
      />
      <capacitor
        name="C_SPI1"
        capacitance="1uF"
        footprint="0603"
        pcbX={9}
        pcbY={3}
        schSectionName="Controller"
        connections={{ pin1: "net.VDD_SPI", pin2: "net.GND" }}
      />
      <capacitor
        name="C_SPI2"
        capacitance="100nF"
        footprint="0402"
        pcbX={9}
        pcbY={6}
        schSectionName="Controller"
        connections={{ pin1: "net.VDD_SPI", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MCU1"
        capacitance="10uF"
        footprint="0805"
        pcbX={-9}
        pcbY={13}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MCU2"
        capacitance="1uF"
        footprint="0603"
        pcbX={-9}
        pcbY={10}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MCU3"
        capacitance="100nF"
        footprint="0402"
        pcbX={8}
        pcbY={12}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MCU4"
        capacitance="100nF"
        footprint="0402"
        pcbX={8}
        pcbY={9}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MCU5"
        capacitance="100nF"
        footprint="0402"
        pcbX={-9}
        pcbY={7}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <resistor
        name="R_EN"
        resistance="10k"
        footprint="0603"
        pcbX={-17}
        pcbY={14}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.EN" }}
      />
      <capacitor
        name="C_EN"
        capacitance="1uF"
        footprint="0603"
        pcbX={-18}
        pcbY={12}
        pcbRotation={180}
        schSectionName="Controller"
        connections={{ pin1: "net.EN", pin2: "net.GND" }}
      />
      <pushbutton
        name="SW_RESET"
        manufacturerPartNumber="B3U-1000P"
        footprint={buttonFootprint}
        pcbX={-18}
        pcbY={37}
        schSectionName="Controller"
        connections={{ pin1: "net.EN", pin2: "net.GND" }}
      />
      <resistor
        name="R_BOOT"
        resistance="10k"
        footprint="0603"
        pcbX={-13}
        pcbY={5}
        schSectionName="Controller"
        connections={{ pin1: "net.V3V3", pin2: "net.BOOT" }}
      />
      <pushbutton
        name="SW_BOOT"
        manufacturerPartNumber="B3U-1000P"
        footprint={buttonFootprint}
        pcbX={-27}
        pcbY={37}
        schSectionName="Controller"
        connections={{ pin1: "net.BOOT", pin2: "net.GND" }}
      />
      <crystal
        name="Y_XTAL"
        manufacturerPartNumber="ABM8G-40.000MHZ-B4Y-T"
        frequency="40MHz"
        loadCapacitance="10pF"
        pinVariant="four_pin"
        footprint="crystal4_px3.2mm_py2.5mm"
        pcbX={-1}
        pcbY={12}
        schSectionName="Controller"
        connections={{
          pin1: "net.XTAL_P",
          pin2: "net.GND",
          pin3: "net.XTAL_N",
          pin4: "net.GND",
        }}
      />
      <capacitor
        name="C_XTAL_P"
        capacitance="10pF"
        footprint="0402"
        pcbX={-6}
        pcbY={14}
        pcbRotation={180}
        schSectionName="Controller"
        connections={{ pin1: "net.XTAL_P", pin2: "net.GND" }}
      />
      <capacitor
        name="C_XTAL_N"
        capacitance="10pF"
        footprint="0402"
        pcbX={3}
        pcbY={16}
        pcbRotation={180}
        schSectionName="Controller"
        connections={{ pin1: "net.XTAL_N", pin2: "net.GND" }}
      />
      <trace
        from=".U_MCU > .GPIO41"
        to=".R_OLED_SDA > .pin2"
        pcbPathRelativeTo=".U_MCU > .GPIO41"
        pcbPath={[
          { x: 1, y: 3.95 },
          { x: 2, y: 3.95 },
          { x: 2, y: 4.4, via: true, fromLayer: "top", toLayer: "bottom" },
          { x: 29, y: 4.4 },
          { x: 29, y: 18 },
          { x: 33, y: 18, via: true, fromLayer: "bottom", toLayer: "top" },
          ".R_OLED_SDA > .pin2",
        ]}
      />
      <trace
        from=".U_MCU > .XTAL_P"
        to=".Y_XTAL > .pin1"
        pcbPath={[{ x: -1.8, y: 3.9 }, ".Y_XTAL > .pin1"]}
      />
      <trace
        from=".U_MCU > .XTAL_N"
        to=".Y_XTAL > .pin3"
        pcbPath={[
          { x: -1.4, y: 4.1 },
          { x: -0.8, y: 5.3 },
          { x: -0.8, y: 6.45 },
          ".Y_XTAL > .pin3",
        ]}
      />
      <trace
        from=".Y_XTAL > .pin3"
        to=".C_XTAL_N > .pin1"
        pcbPath={[".C_XTAL_N > .pin1"]}
      />
      <trace
        from=".Y_XTAL > .pin1"
        to=".C_XTAL_P > .pin1"
        pcbPath={[".C_XTAL_P > .pin1"]}
      />
    </>
  )
}
