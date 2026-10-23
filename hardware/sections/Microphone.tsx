import { nets } from "../nets"
import { Inmp441Module } from "../components/Inmp441"

export function Microphone() {
  return (
    <>
      <schematicsection name="Microphone" displayName="麦克风" />
      <Inmp441Module
        doNotPlace
        name="MIC"
        schSectionName="Microphone"
        schX={-11}
        schY={0}
        connections={{
          VDD: nets.power.v3v3.selector,
          GND: nets.power.gnd.selector,
          L_R: nets.power.gnd.selector,
          WS: nets.microphone.ws.selector,
          SCK: nets.microphone.sck.selector,
          SD: nets.microphone.sd.selector,
        }}
      />
    </>
  )
}
