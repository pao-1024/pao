import { WS2812B_2020 } from "../imports/WS2812B_2020"

const usbContacts = [
  { pin: 1, x: 0, y: 0 },
  { pin: 2, x: 0.85, y: 0 },
  { pin: 3, x: 1.7, y: 0 },
  { pin: 4, x: 2.55, y: 0 },
  { pin: 5, x: 3.4, y: 0 },
  { pin: 6, x: 4.25, y: 0 },
  { pin: 7, x: 5.1, y: 0 },
  { pin: 8, x: 5.95, y: 0 },
  { pin: 9, x: 0, y: -1.35 },
  { pin: 10, x: 0.85, y: -1.35 },
  { pin: 11, x: 1.7, y: -1.35 },
  { pin: 12, x: 2.55, y: -1.35 },
  { pin: 13, x: 3.4, y: -1.35 },
  { pin: 14, x: 4.25, y: -1.35 },
  { pin: 15, x: 5.1, y: -1.35 },
  { pin: 16, x: 5.95, y: -1.35 },
]

// USB4085 官方封装规定接口处的 PCB 边缘距首排信号孔 6.1 mm。
export function UsbStatusRf() {
  return (
    <>
      <schematicsection name="Usb" displayName="USB-C、指示灯和射频" />
      <connector
        name="J_USB"
        manufacturerPartNumber="USB4085-GF-A"
        pcbX={-46}
        pcbY={-38.9}
        pinLabels={{
          pin1: "A1_GND",
          pin2: "A4_VBUS",
          pin3: "A5_CC1",
          pin4: "A6_DP",
          pin5: "A7_DM",
          pin6: "A8_SBU",
          pin7: "A9_VBUS",
          pin8: "A12_GND",
          pin9: "B12_GND",
          pin10: "B9_VBUS",
          pin11: "B8_SBU",
          pin12: "B7_DM",
          pin13: "B6_DP",
          pin14: "B5_CC2",
          pin15: "B4_VBUS",
          pin16: "B1_GND",
          pin17: "SHELL",
        }}
        noConnect={["A8_SBU", "B8_SBU"]}
        schSectionName="Usb"
        footprint={
          <footprint insertionDirection="from_bottom">
            {usbContacts.map(({ pin, x, y }) => (
              <platedhole
                key={pin}
                shape="circle"
                pcbX={x}
                pcbY={y}
                holeDiameter="0.4mm"
                outerDiameter="0.7mm"
                portHints={[`pin${pin}`]}
              />
            ))}
            {[-1.35, 7.3].map((x) =>
              [-0.98, -4.36].map((y) => (
                <platedhole
                  key={`${x}-${y}`}
                  shape="oval"
                  pcbX={x}
                  pcbY={y}
                  holeWidth="0.6mm"
                  holeHeight={y === -0.98 ? "2.1mm" : "1.4mm"}
                  outerWidth="0.9mm"
                  outerHeight={y === -0.98 ? "2.4mm" : "1.7mm"}
                  portHints={["pin17"]}
                />
              )),
            )}
          </footprint>
        }
        connections={{
          A1_GND: "net.GND",
          A4_VBUS: "net.USB_5V",
          A5_CC1: "net.CC1",
          A6_DP: "net.USB_DP_CONN",
          A7_DM: "net.USB_DM_CONN",
          A9_VBUS: "net.USB_5V",
          A12_GND: "net.GND",
          B12_GND: "net.GND",
          B9_VBUS: "net.USB_5V",
          B7_DM: "net.USB_DM_CONN",
          B6_DP: "net.USB_DP_CONN",
          B5_CC2: "net.CC2",
          B4_VBUS: "net.USB_5V",
          B1_GND: "net.GND",
          SHELL: "net.GND",
        }}
      />
      <resistor
        name="R_CC1"
        resistance="5.1k"
        footprint="0603"
        pcbX={-38}
        pcbY={-25}
        schSectionName="Usb"
        connections={{ pin1: "net.CC1", pin2: "net.GND" }}
      />
      <resistor
        name="R_CC2"
        resistance="5.1k"
        footprint="0603"
        pcbX={-38}
        pcbY={-28}
        schSectionName="Usb"
        connections={{ pin1: "net.CC2", pin2: "net.GND" }}
      />
      <resistor
        name="R_USB_DP"
        resistance="22"
        footprint="0603"
        pcbX={5}
        pcbY={-19}
        schSectionName="Usb"
        connections={{ pin1: "net.USB_DP", pin2: "net.USB_DP_CONN" }}
      />
      <resistor
        name="R_USB_DM"
        resistance="22"
        footprint="0603"
        pcbX={5}
        pcbY={-22}
        schSectionName="Usb"
        connections={{ pin1: "net.USB_DM", pin2: "net.USB_DM_CONN" }}
      />
      <chip
        name="U_USB_ESD"
        manufacturerPartNumber="USBLC6-2SC6"
        footprint="sot23_6"
        pinLabels={{
          pin1: "DP_A",
          pin2: "GND",
          pin3: "DM_A",
          pin4: "DM_B",
          pin5: "VBUS",
          pin6: "DP_B",
        }}
        pcbX={-44}
        pcbY={-23}
        schSectionName="Usb"
        connections={{
          DP_A: "net.USB_DP_CONN",
          DP_B: "net.USB_DP_CONN",
          DM_A: "net.USB_DM_CONN",
          DM_B: "net.USB_DM_CONN",
          VBUS: "net.USB_5V",
          GND: "net.GND",
        }}
      />

      <chip
        name="U_RGB_BUF"
        manufacturerPartNumber="SN74AHCT1G125DBVR"
        footprint="sot23_5"
        pinLabels={{
          pin1: "OE_N",
          pin2: "A",
          pin3: "GND",
          pin4: "Y",
          pin5: "VCC",
        }}
        pcbX={-3}
        pcbY={-16}
        schSectionName="Usb"
        connections={{
          OE_N: "net.GND",
          A: "net.RGB_DATA",
          GND: "net.GND",
          Y: "net.RGB_DATA_5V",
          VCC: "net.V5",
        }}
      />
      <capacitor
        name="C_RGB_BUF"
        capacitance="100nF"
        footprint="0402"
        pcbX={1}
        pcbY={-16}
        schSectionName="Usb"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />
      <resistor
        name="R_RGB"
        resistance="330"
        footprint="0603"
        pcbX={-3}
        pcbY={-22}
        schSectionName="Usb"
        connections={{ pin1: "net.RGB_DATA_5V", pin2: "net.RGB_DIN" }}
      />
      <WS2812B_2020
        name="D_RGB"
        noConnect={["DO"]}
        pcbX={-3}
        pcbY={-27}
        schSectionName="Usb"
        connections={{ VDD: "net.V5", GND: "net.GND", DI: "net.RGB_DIN" }}
      />
      <capacitor
        name="C_RGB"
        capacitance="100nF"
        footprint="0402"
        pcbX={2}
        pcbY={-27}
        schSectionName="Usb"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />

      <capacitor
        name="C_RF1"
        capacitance="1.5pF"
        footprint="0201"
        pcbX={-12}
        pcbY={11}
        schSectionName="Usb"
        connections={{ pin1: "net.RF_IN", pin2: "net.GND" }}
      />
      <inductor
        name="L_RF"
        inductance="2.4nH"
        footprint="0201"
        pcbX={-14}
        pcbY={9}
        pcbRotation={180}
        schSectionName="Usb"
        connections={{ pin1: "net.RF_IN", pin2: "net.RF_ANT" }}
      />
      <capacitor
        name="C_RF2"
        capacitance="1.5pF"
        footprint="0201"
        pcbX={-16}
        pcbY={7}
        pcbRotation={180}
        schSectionName="Usb"
        connections={{ pin1: "net.RF_ANT", pin2: "net.GND" }}
      />
      <connector
        name="J_RF"
        manufacturerPartNumber="U.FL-R-SMT-1(10)"
        footprint={
          <footprint insertionDirection="from_above">
            <smtpad
              shape="rect"
              pcbX={-1.05}
              pcbY={0}
              width="1.05mm"
              height="1mm"
              portHints={["pin1"]}
            />
            <smtpad
              shape="rect"
              pcbX={0.475}
              pcbY={1.475}
              width="2.2mm"
              height="1.05mm"
              portHints={["pin2"]}
            />
            <smtpad
              shape="rect"
              pcbX={0.475}
              pcbY={-1.475}
              width="2.2mm"
              height="1.05mm"
              portHints={["pin2"]}
            />
          </footprint>
        }
        pinLabels={{ pin1: "RF", pin2: "GND" }}
        pcbX={-9}
        pcbY={1}
        schSectionName="Usb"
        connections={{ RF: "net.RF_ANT", GND: "net.GND" }}
      />
    </>
  )
}
