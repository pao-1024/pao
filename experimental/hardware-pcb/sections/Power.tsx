import { BQ29700DSER } from "../imports/BQ29700DSER"
import { CSD16301Q2 } from "../imports/CSD16301Q2"
import { CSD25402Q3A } from "../imports/CSD25402Q3A"
import { JS102011SAQN } from "../imports/JS102011SAQN"
import { XFL4020_222MEC } from "../imports/XFL4020_222MEC"
import { jstPh3Footprint } from "../imports/B3B_PH_K_S_LF__SN_"
import { tps61088Footprint } from "../imports/TPS61088RHLR"
import { tps62132Footprint } from "../imports/TPS62132RGTR"

// 单节锂电：USB 充电、低侧保护、5 V 升压、3.3 V 降压。
export function Power() {
  return (
    <>
      <schematicsection name="Power" displayName="电池、充电保护与稳压" />
      <connector
        name="J_BAT"
        manufacturerPartNumber="B3B-PH-K-S(LF)(SN)"
        footprint={jstPh3Footprint}
        supplierPartNumbers={{ jlcpcb: ["C131339"] }}
        pinLabels={{ pin1: "CELL_P", pin2: "CELL_N", pin3: "NTC" }}
        pcbX={-50}
        pcbY={-7}
        schSectionName="Power"
        connections={{
          CELL_P: "net.CELL_P",
          CELL_N: "net.CELL_N",
          NTC: "net.BAT_NTC",
        }}
      />
      <chip
        name="U_CHARGER"
        manufacturerPartNumber="TP4056-42-ESOP8"
        footprint={
          <footprint>
            {[1, 2, 3, 4].map((pin) => (
              <smtpad
                key={pin}
                shape="rect"
                portHints={[`pin${pin}`]}
                pcbX={-2.7}
                pcbY={1.905 - (pin - 1) * 1.27}
                width="1.5mm"
                height="0.6mm"
              />
            ))}
            {[5, 6, 7, 8].map((pin) => (
              <smtpad
                key={pin}
                shape="rect"
                portHints={[`pin${pin}`]}
                pcbX={2.7}
                pcbY={-1.905 + (pin - 5) * 1.27}
                width="1.5mm"
                height="0.6mm"
              />
            ))}
            <smtpad
              shape="rect"
              portHints={["pin9"]}
              pcbX={0}
              pcbY={0}
              width="2mm"
              height="2mm"
            />
          </footprint>
        }
        pinLabels={{
          pin1: "TEMP",
          pin2: "PROG",
          pin3: "GND",
          pin4: "VCC",
          pin5: "BAT",
          pin6: "STDBY",
          pin7: "CHRG",
          pin8: "CE",
          pin9: "EP",
        }}
        noConnect={["STDBY", "CHRG"]}
        pcbX={-30}
        pcbY={-35}
        schSectionName="Power"
        connections={{
          TEMP: "net.BAT_TEMP",
          PROG: "net.CHG_PROG",
          GND: "net.GND",
          VCC: "net.USB_5V",
          BAT: "net.CELL_P",
          CE: "net.USB_5V",
          EP: "net.GND",
        }}
      />
      <resistor
        name="R_CHG_PROG"
        resistance="12k"
        footprint="0603"
        pcbX={-24}
        pcbY={-40}
        schSectionName="Power"
        connections={{ pin1: "net.CHG_PROG", pin2: "net.GND" }}
      />
      <resistor
        name="R_NTC_TOP"
        resistance="7.5k"
        footprint="0603"
        pcbX={-31}
        pcbY={-41}
        schSectionName="Power"
        connections={{ pin1: "net.USB_5V", pin2: "net.BAT_TEMP" }}
      />
      <resistor
        name="R_NTC_SER"
        resistance="0"
        footprint="0603"
        pcbX={-36}
        pcbY={-41}
        schSectionName="Power"
        connections={{ pin1: "net.BAT_NTC", pin2: "net.BAT_TEMP" }}
      />
      <capacitor
        name="C_CHG_IN"
        capacitance="10uF"
        footprint="0805"
        pcbX={-22}
        pcbY={-34}
        schSectionName="Power"
        connections={{ pin1: "net.USB_5V", pin2: "net.GND" }}
      />
      <capacitor
        name="C_CHG_BAT"
        capacitance="10uF"
        footprint="0805"
        pcbX={-22}
        pcbY={-30}
        schSectionName="Power"
        connections={{ pin1: "net.CELL_P", pin2: "net.GND" }}
      />

      <BQ29700DSER
        name="U_PROTECT"
        noConnect={["NC"]}
        pcbX={-37}
        pcbY={-17}
        schSectionName="Power"
        connections={{
          COUT: "net.CHG_GATE",
          DOUT: "net.DSG_GATE",
          VSS: "net.CELL_N",
          BAT: "net.PROT_BAT",
          V_NEG: "net.PROT_SENSE",
        }}
      />
      <resistor
        name="R_PROT_BAT"
        resistance="330"
        footprint="0402"
        pcbX={-41}
        pcbY={-15}
        schSectionName="Power"
        connections={{ pin1: "net.CELL_P", pin2: "net.PROT_BAT" }}
      />
      <capacitor
        name="C_PROT"
        capacitance="100nF"
        footprint="0603"
        pcbX={-41}
        pcbY={-18}
        schSectionName="Power"
        connections={{ pin1: "net.PROT_BAT", pin2: "net.CELL_N" }}
      />
      <resistor
        name="R_PROT_SENSE"
        resistance="2.2k"
        footprint="0402"
        pcbX={-33}
        pcbY={-15}
        pcbRotation={180}
        schSectionName="Power"
        connections={{ pin1: "net.GND", pin2: "net.PROT_SENSE" }}
      />
      <CSD16301Q2
        name="Q_DSG"
        pcbX={-32}
        pcbY={-20}
        schSectionName="Power"
        connections={{
          S1: "net.CELL_N",
          S2: "net.CELL_N",
          G: "net.DSG_GATE",
          D1: "net.PROT_MID",
          D2: "net.PROT_MID",
          D3: "net.PROT_MID",
          D4: "net.PROT_MID",
          D5: "net.PROT_MID",
        }}
      />
      <CSD16301Q2
        name="Q_CHG"
        pcbX={-27}
        pcbY={-20}
        schSectionName="Power"
        connections={{
          S1: "net.GND",
          S2: "net.GND",
          G: "net.CHG_GATE",
          D1: "net.PROT_MID",
          D2: "net.PROT_MID",
          D3: "net.PROT_MID",
          D4: "net.PROT_MID",
          D5: "net.PROT_MID",
        }}
      />
      <resistor
        name="R_DSG_GATE"
        resistance="5.1M"
        footprint="0603"
        pcbX={-37}
        pcbY={-22}
        schSectionName="Power"
        connections={{ pin1: "net.DSG_GATE", pin2: "net.CELL_N" }}
      />
      <resistor
        name="R_CHG_GATE"
        resistance="5.1M"
        footprint="0603"
        pcbX={-27}
        pcbY={-24}
        schSectionName="Power"
        connections={{ pin1: "net.CHG_GATE", pin2: "net.GND" }}
      />

      {/* TPS61088 关断时输入仍可经体二极管到输出，因此用高侧 MOSFET 断开输入。 */}
      <CSD25402Q3A
        name="Q_POWER"
        pcbX={-40}
        pcbY={-5}
        schSectionName="Power"
        connections={{
          D1: "net.SYS_BAT",
          D2: "net.SYS_BAT",
          D3: "net.SYS_BAT",
          G: "net.POWER_GATE",
          S1: "net.CELL_P",
          S2: "net.CELL_P",
          S3: "net.CELL_P",
          S4: "net.CELL_P",
          S5: "net.CELL_P",
        }}
      />
      <resistor
        name="R_POWER_GATE"
        resistance="100k"
        footprint="0603"
        pcbX={-44}
        pcbY={-3}
        schSectionName="Power"
        connections={{ pin1: "net.CELL_P", pin2: "net.POWER_GATE" }}
      />
      <JS102011SAQN
        name="SW_POWER"
        noConnect={["pin1"]}
        pcbX={-50}
        pcbY={-22}
        schSectionName="Power"
        connections={{ pin2: "net.POWER_GATE", pin3: "net.GND" }}
      />
      <resistor
        name="R_BOOST_EN"
        resistance="100k"
        footprint="0603"
        pcbX={-25}
        pcbY={-7}
        schSectionName="Power"
        connections={{ pin1: "net.SYS_BAT", pin2: "net.GND" }}
      />

      <chip
        name="U_BOOST"
        manufacturerPartNumber="TPS61088RHLR"
        supplierPartNumbers={{ jlcpcb: ["C87357"] }}
        footprint={tps61088Footprint}
        pinLabels={{
          pin1: "VCC",
          pin2: "EN",
          pin3: "FSW",
          pin4: "SW1",
          pin5: "SW2",
          pin6: "SW3",
          pin7: "SW4",
          pin8: "BOOT",
          pin9: "VIN",
          pin10: "SS",
          pin11: "NC11",
          pin12: "NC12",
          pin13: "MODE",
          pin14: "VOUT1",
          pin15: "VOUT2",
          pin16: "VOUT3",
          pin17: "FB",
          pin18: "COMP",
          pin19: "ILIM",
          pin20: "AGND",
          pin21: "PGND",
        }}
        pcbX={-18}
        pcbY={-13}
        schSectionName="Power"
        noConnect={["NC11", "NC12"]}
        connections={{
          VCC: "net.BOOST_VCC",
          EN: "net.SYS_BAT",
          FSW: "net.BOOST_FSW",
          SW1: "net.BOOST_SW",
          SW2: "net.BOOST_SW",
          SW3: "net.BOOST_SW",
          SW4: "net.BOOST_SW",
          BOOT: "net.BOOST_BOOT",
          VIN: "net.SYS_BAT",
          SS: "net.BOOST_SS",
          MODE: "net.GND",
          VOUT1: "net.BOOST_5V",
          VOUT2: "net.BOOST_5V",
          VOUT3: "net.BOOST_5V",
          FB: "net.BOOST_FB",
          COMP: "net.BOOST_COMP",
          ILIM: "net.BOOST_ILIM",
          AGND: "net.GND",
          PGND: "net.GND",
        }}
      />
      <inductor
        name="L_BOOST"
        manufacturerPartNumber="CDMC8D28NP-1R2MC"
        inductance="1.2uH"
        footprint={
          <footprint>
            <smtpad
              shape="rect"
              pcbX={-3.875}
              pcbY={0}
              width="2.75mm"
              height="4mm"
              portHints={["pin1"]}
            />
            <smtpad
              shape="rect"
              pcbX={3.875}
              pcbY={0}
              width="2.75mm"
              height="4mm"
              portHints={["pin2"]}
            />
          </footprint>
        }
        pcbX={-18}
        pcbY={-1}
        schSectionName="Power"
        connections={{ pin1: "net.SYS_BAT", pin2: "net.BOOST_SW" }}
      />
      <capacitor
        name="C_BOOST_IN1"
        capacitance="22uF"
        footprint="1206"
        pcbX={-29}
        pcbY={-1}
        schSectionName="Power"
        connections={{ pin1: "net.SYS_BAT", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BOOST_IN2"
        capacitance="22uF"
        footprint="1206"
        pcbX={-29}
        pcbY={3}
        schSectionName="Power"
        connections={{ pin1: "net.SYS_BAT", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BOOST_VCC"
        capacitance="4.7uF"
        footprint="0603"
        pcbX={-22}
        pcbY={-11}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_VCC", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BOOST_BOOT"
        capacitance="100nF"
        footprint="0402"
        pcbX={-13}
        pcbY={-9}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_BOOT", pin2: "net.BOOST_SW" }}
      />
      <resistor
        name="R_BOOST_FSW"
        resistance="255k"
        footprint="0402"
        pcbX={-21}
        pcbY={-16}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_FSW", pin2: "net.BOOST_SW" }}
      />
      <resistor
        name="R_BOOST_ILIM"
        resistance="100k"
        footprint="0402"
        pcbX={-14}
        pcbY={-17}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_ILIM", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BOOST_SS"
        capacitance="47nF"
        footprint="0402"
        pcbX={-20}
        pcbY={-20}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_SS", pin2: "net.GND" }}
      />
      <resistor
        name="R_BOOST_FB_TOP"
        resistance="174k"
        footprint="0402"
        pcbX={-10}
        pcbY={-11}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_5V", pin2: "net.BOOST_FB" }}
      />
      <resistor
        name="R_BOOST_FB_BOT"
        resistance="56.2k"
        footprint="0402"
        pcbX={-10}
        pcbY={-14}
        pcbRotation={180}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_FB", pin2: "net.GND" }}
      />
      <resistor
        name="R_BOOST_COMP"
        resistance="17.4k"
        footprint="0402"
        pcbX={-10}
        pcbY={-18}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_COMP", pin2: "net.BOOST_COMP_RC" }}
      />
      <capacitor
        name="C_BOOST_COMP"
        capacitance="4.7nF"
        footprint="0402"
        pcbX={-10}
        pcbY={-21}
        pcbRotation={180}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_COMP_RC", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BOOST_OUT1"
        capacitance="22uF"
        footprint="1206"
        pcbX={-3}
        pcbY={-10}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_5V", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BOOST_OUT2"
        capacitance="22uF"
        footprint="1206"
        pcbX={-3}
        pcbY={-6}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_5V", pin2: "net.GND" }}
      />
      <inductor
        name="L_5V_FILTER"
        manufacturerPartNumber="BLM21PG300SN1"
        inductance="0H"
        footprint="0805"
        pcbX={5}
        pcbY={-11}
        schSectionName="Power"
        connections={{ pin1: "net.BOOST_5V", pin2: "net.V5" }}
      />

      <chip
        name="U_BUCK"
        manufacturerPartNumber="TPS62132RGTR"
        supplierPartNumbers={{ jlcpcb: ["C81563"] }}
        footprint={tps62132Footprint}
        pinLabels={{
          pin1: "SW1",
          pin2: "SW2",
          pin3: "SW3",
          pin4: "PG",
          pin5: "FB",
          pin6: "AGND",
          pin7: "FSW",
          pin8: "DEF",
          pin9: "SS",
          pin10: "AVIN",
          pin11: "PVIN1",
          pin12: "PVIN2",
          pin13: "EN",
          pin14: "VOS",
          pin15: "PGND1",
          pin16: "PGND2",
          pin17: "EP",
        }}
        pcbX={12}
        pcbY={-29}
        schSectionName="Power"
        connections={{
          SW1: "net.BUCK_SW",
          SW2: "net.BUCK_SW",
          SW3: "net.BUCK_SW",
          PG: "net.BUCK_PG",
          FB: "net.GND",
          AGND: "net.GND",
          FSW: "net.V3V3",
          DEF: "net.GND",
          SS: "net.BUCK_SS",
          AVIN: "net.V5",
          PVIN1: "net.V5",
          PVIN2: "net.V5",
          EN: "net.V5",
          VOS: "net.V3V3",
          PGND1: "net.GND",
          PGND2: "net.GND",
          EP: "net.GND",
        }}
      />
      <XFL4020_222MEC
        name="L_BUCK"
        pcbX={19}
        pcbY={-29}
        schSectionName="Power"
        connections={{ pin1: "net.BUCK_SW", pin2: "net.V3V3" }}
      />
      <capacitor
        name="C_BUCK_IN"
        capacitance="10uF"
        footprint="1206"
        pcbX={8}
        pcbY={-34}
        schSectionName="Power"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BUCK_AVIN"
        capacitance="100nF"
        footprint="0603"
        pcbX={8}
        pcbY={-29}
        schSectionName="Power"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BUCK_SS"
        capacitance="3.3nF"
        footprint="0603"
        pcbX={12}
        pcbY={-35}
        pcbRotation={180}
        schSectionName="Power"
        connections={{ pin1: "net.BUCK_SS", pin2: "net.GND" }}
      />
      <capacitor
        name="C_BUCK_OUT"
        capacitance="22uF"
        footprint="0805"
        pcbX={22}
        pcbY={-33}
        schSectionName="Power"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <trace
        from=".U_BUCK > .EP"
        to=".U_BUCK > .PGND1"
        pcbPath={[".U_BUCK > .PGND1"]}
      />
      <resistor
        name="R_BUCK_PG"
        resistance="100k"
        footprint="0603"
        pcbX={5}
        pcbY={-27}
        schSectionName="Power"
        connections={{ pin1: "net.V3V3", pin2: "net.BUCK_PG" }}
      />
    </>
  )
}
