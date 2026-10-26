import { jstPh2Footprint } from "../imports/B2B_PH_K_S_LF__SN_"
import { max98357Footprint } from "../imports/MAX98357AETE_T"

// INMP441 焊盘尺寸及音孔按 TDK DS-INMP441-00，底部音孔必须与 PCB 开孔对齐。
const micPads = [
  { pin: 1, x: -1.33, y: -1.575 },
  { pin: 2, x: -1.33, y: -0.525 },
  { pin: 3, x: -1.33, y: 0.525 },
  { pin: 4, x: -1.33, y: 1.575 },
  { pin: 6, x: 1.33, y: 1.575 },
  { pin: 7, x: 1.33, y: 0.525 },
  { pin: 8, x: 1.33, y: -0.525 },
  { pin: 9, x: 1.33, y: -1.575 },
]

export function Audio() {
  return (
    <>
      <schematicsection name="Audio" displayName="麦克风与功放" />
      <chip
        name="U_MIC"
        manufacturerPartNumber="INMP441ACEZ-R0"
        pinLabels={{
          pin1: "SCK",
          pin2: "SD",
          pin3: "WS",
          pin4: "LR",
          pin5: "GND_A",
          pin6: "GND_B",
          pin7: "VDD",
          pin8: "CHIPEN",
          pin9: "GND_C",
        }}
        footprint={
          <footprint>
            {micPads.map((pad) => (
              <smtpad
                key={pad.pin}
                shape="rect"
                portHints={[`pin${pad.pin}`]}
                pcbX={pad.x}
                pcbY={pad.y}
                width="0.4mm"
                height="0.6mm"
              />
            ))}
            <platedhole
              shape="circle"
              portHints={["pin5"]}
              pcbX={0}
              pcbY={0}
              holeDiameter="0.6mm"
              outerDiameter="1.56mm"
            />
          </footprint>
        }
        pcbX={-22}
        pcbY={16}
        schX={-12}
        schY={-15}
        schSectionName="Audio"
        connections={{
          SCK: "net.MIC_SCK",
          SD: "net.MIC_SD",
          WS: "net.MIC_WS",
          LR: "net.GND",
          GND_A: "net.GND",
          GND_B: "net.GND",
          GND_C: "net.GND",
          VDD: "net.V3V3",
          CHIPEN: "net.V3V3",
        }}
      />
      <capacitor
        name="C_MIC"
        capacitance="100nF"
        footprint="0402"
        pcbX={-26}
        pcbY={16}
        schSectionName="Audio"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <resistor
        name="R_MIC_SD"
        resistance="100k"
        footprint="0603"
        pcbX={-26}
        pcbY={12}
        schSectionName="Audio"
        connections={{ pin1: "net.MIC_SD", pin2: "net.GND" }}
      />
      <chip
        name="U_AMP"
        manufacturerPartNumber="MAX98357AETE+T"
        supplierPartNumbers={{ jlcpcb: ["C910544"] }}
        footprint={max98357Footprint}
        pinLabels={{
          pin1: "DIN",
          pin2: "GAIN",
          pin3: "GND_A",
          pin4: "SD_MODE",
          pin5: "NC5",
          pin6: "NC6",
          pin7: "VDD_A",
          pin8: "VDD_B",
          pin9: "OUTP",
          pin10: "OUTN",
          pin11: "GND_B",
          pin12: "NC12",
          pin13: "NC13",
          pin14: "LRCLK",
          pin15: "GND_C",
          pin16: "BCLK",
          pin17: "EP",
        }}
        noConnect={["NC5", "NC6", "NC12", "NC13"]}
        pcbX={22}
        pcbY={14}
        schX={12}
        schY={-15}
        schSectionName="Audio"
        connections={{
          DIN: "net.AMP_DIN",
          GAIN: "net.GND",
          GND_A: "net.GND",
          SD_MODE: "net.V3V3",
          VDD_A: "net.V3V3",
          VDD_B: "net.V3V3",
          OUTP: "net.SPK_P",
          OUTN: "net.SPK_N",
          GND_B: "net.GND",
          LRCLK: "net.AMP_LRC",
          GND_C: "net.GND",
          BCLK: "net.AMP_BCLK",
          EP: "net.GND",
        }}
      />
      <capacitor
        name="C_AMP1"
        capacitance="10uF"
        footprint="0805"
        pcbX={27}
        pcbY={16}
        schSectionName="Audio"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <capacitor
        name="C_AMP2"
        capacitance="100nF"
        footprint="0402"
        pcbX={27}
        pcbY={12}
        schSectionName="Audio"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
      <connector
        name="J_SPEAKER"
        manufacturerPartNumber="B2B-PH-K-S(LF)(SN)"
        supplierPartNumbers={{ jlcpcb: ["C131337"] }}
        footprint={jstPh2Footprint}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        pcbX={50}
        pcbY={6}
        schX={20}
        schY={-15}
        schSectionName="Audio"
        connections={{ PLUS: "net.SPK_P", MINUS: "net.SPK_N" }}
      />
    </>
  )
}
