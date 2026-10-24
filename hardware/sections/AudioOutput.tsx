import { nets } from "../nets"
import { Max98357Module } from "../components/Max98357"

export function AudioOutput() {
  return (
    <>
      <schematicsection name="AudioOutput" displayName="功放与扬声器" />
      <Max98357Module
        doNotPlace
        name="AMP"
        schSectionName="AudioOutput"
        schX={7.5}
        schY={3}
        connections={{
          VIN: nets.power.v3v3.selector,
          GND: nets.power.gnd.selector,
          SD_MODE: nets.power.v3v3.selector,
          GAIN: nets.power.gnd.selector,
          DIN: nets.audioOutput.din.selector,
          BCLK: nets.audioOutput.bclk.selector,
          LRC: nets.audioOutput.lrc.selector,
          OUT_PLUS: "SPEAKER.pos",
          OUT_MINUS: "SPEAKER.neg",
        }}
      />
      <netlabel
        net={nets.power.v3v3.name}
        connection="AMP.VIN"
        schX={7}
        schY={4.6}
        anchorSide="bottom"
      />
      <netlabel
        net={nets.power.gnd.name}
        connection="AMP.GND"
        schX={7}
        schY={1.4}
        anchorSide="top"
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
