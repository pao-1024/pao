import { Max98357Module } from "../components/Max98357"

export function AudioOutput() {
  return (
    <>
      <schematicsection name="AudioOutput" displayName="04 功放与扬声器" />
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
      <netlabel
        net="GND"
        connection="AMP.GND"
        schX={5.55}
        schY={3.2}
        anchorSide="right"
      />
      <schematicsymbol
        name="SPEAKER"
        symbolName="speaker_horz"
        schSectionName="AudioOutput"
        schX={12}
        schY={3}
      />
    </>
  )
}
