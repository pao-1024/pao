import { Inmp441Module } from "../components/Inmp441"

export function Microphone() {
  return (
    <>
      <schematicsection name="Microphone" displayName="03 麦克风" />
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
    </>
  )
}
