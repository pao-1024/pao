// UG-2864HSWEG01 为 30 极 0.7 mm FPC 裸屏，PCB 接点需热压连接。
const oledPins = {
  pin1: "NC1",
  pin2: "C2P",
  pin3: "C2N",
  pin4: "C1P",
  pin5: "C1N",
  pin6: "VBAT",
  pin7: "NC7",
  pin8: "VSS",
  pin9: "VDD",
  pin10: "BS0",
  pin11: "BS1",
  pin12: "BS2",
  pin13: "CS_N",
  pin14: "RES_N",
  pin15: "DC_N",
  pin16: "RW_N",
  pin17: "E_N",
  pin18: "D0",
  pin19: "D1",
  pin20: "D2",
  pin21: "D3",
  pin22: "D4",
  pin23: "D5",
  pin24: "D6",
  pin25: "D7",
  pin26: "IREF",
  pin27: "VCOMH",
  pin28: "VCC",
  pin29: "VLSS",
  pin30: "NC30",
} as const

export function Display() {
  return (
    <>
      <schematicsection name="Display" displayName="0.96 英寸 OLED 裸屏" />
      <chip
        name="U_OLED"
        manufacturerPartNumber="UG-2864HSWEG01"
        pinLabels={oledPins}
        noConnect={["NC7"]}
        footprint={
          <footprint>
            {Array.from({ length: 30 }, (_, index) => (
              <smtpad
                key={index + 1}
                shape="rect"
                portHints={[`pin${index + 1}`]}
                pcbX={(index - 14.5) * 0.7}
                pcbY={0}
                width="0.4mm"
                height="1.5mm"
              />
            ))}
          </footprint>
        }
        pcbX={31}
        pcbY={31}
        schSectionName="Display"
        connections={{
          NC1: "net.GND",
          C2P: "net.OLED_C2P",
          C2N: "net.OLED_C2N",
          C1P: "net.OLED_C1P",
          C1N: "net.OLED_C1N",
          VBAT: "net.OLED_4V",
          VSS: "net.GND",
          VDD: "net.V3V3",
          BS0: "net.GND",
          BS1: "net.V3V3",
          BS2: "net.GND",
          CS_N: "net.GND",
          RES_N: "net.OLED_RESET",
          DC_N: "net.GND",
          RW_N: "net.GND",
          E_N: "net.GND",
          D0: "net.OLED_SCL",
          D1: "net.OLED_SDA",
          D2: "net.OLED_SDA",
          D3: "net.GND",
          D4: "net.GND",
          D5: "net.GND",
          D6: "net.GND",
          D7: "net.GND",
          IREF: "net.OLED_IREF",
          VCOMH: "net.OLED_VCOMH",
          VCC: "net.OLED_VCC",
          VLSS: "net.GND",
          NC30: "net.GND",
        }}
      />
      <chip
        name="U_OLED_LDO"
        manufacturerPartNumber="MCP1702T-4002E/CB"
        footprint="sot23_3"
        pinLabels={{ pin1: "GND", pin2: "VOUT", pin3: "VIN" }}
        pcbX={13}
        pcbY={33}
        schSectionName="Display"
        connections={{ GND: "net.GND", VOUT: "net.OLED_4V", VIN: "net.V5" }}
      />
      <capacitor
        name="C_OLED_LDO_IN"
        capacitance="1uF"
        footprint="0603"
        pcbX={10}
        pcbY={36}
        schSectionName="Display"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />
      <capacitor
        name="C_OLED_LDO_OUT"
        capacitance="1uF"
        footprint="0603"
        pcbX={17}
        pcbY={36}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_4V", pin2: "net.GND" }}
      />
      <capacitor
        name="C_OLED_C1"
        capacitance="1uF"
        footprint="0603"
        pcbX={17}
        pcbY={26}
        schOrientation="vertical"
        schSectionName="Display"
        connections={{ pin1: "net.OLED_C1P", pin2: "net.OLED_C1N" }}
      />
      <capacitor
        name="C_OLED_C2"
        capacitance="1uF"
        footprint="0603"
        pcbX={13}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_C2P", pin2: "net.OLED_C2N" }}
      />
      <capacitor
        name="C_OLED_VBAT"
        capacitance="1uF"
        footprint="0603"
        pcbX={21}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_4V", pin2: "net.GND" }}
      />
      <capacitor
        name="C_OLED_VDD"
        capacitance="1uF"
        footprint="0603"
        pcbX={25}
        pcbY={26}
        pcbRotation={180}
        schSectionName="Display"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <capacitor
        name="C_OLED_VCOMH"
        capacitance="2.2uF"
        footprint="0603"
        pcbX={42}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_VCOMH", pin2: "net.GND" }}
      />
      <capacitor
        name="C_OLED_VCC"
        capacitance="4.7uF"
        footprint="0805"
        pcbX={46}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_VCC", pin2: "net.GND" }}
      />
      <resistor
        name="R_OLED_IREF"
        resistance="390k"
        footprint="0603"
        pcbX={39}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_IREF", pin2: "net.GND" }}
      />
      <resistor
        name="R_OLED_RESET"
        resistance="10k"
        footprint="0603"
        pcbX={43}
        pcbY={36}
        schSectionName="Display"
        connections={{ pin1: "net.V3V3", pin2: "net.OLED_RESET" }}
      />
      <capacitor
        name="C_OLED_RESET"
        capacitance="1uF"
        footprint="0603"
        pcbX={46}
        pcbY={36}
        schSectionName="Display"
        connections={{ pin1: "net.OLED_RESET", pin2: "net.GND" }}
      />
      <resistor
        name="R_OLED_SCL"
        resistance="4.7k"
        footprint="0603"
        pcbX={31}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.V3V3", pin2: "net.OLED_SCL" }}
      />
      <resistor
        name="R_OLED_SDA"
        resistance="4.7k"
        footprint="0603"
        pcbX={35}
        pcbY={26}
        schSectionName="Display"
        connections={{ pin1: "net.V3V3", pin2: "net.OLED_SDA" }}
      />
    </>
  )
}
