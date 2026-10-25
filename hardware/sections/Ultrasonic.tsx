import { HcSr04Module } from "../components/HcSr04"
import { nets } from "../nets"

export function Ultrasonic() {
  return (
    <>
      <schematicsection name="Ultrasonic" />
      <schematictext
        text="HC-SR04 超声波测距 / 3.3V"
        schX={7.5}
        schY={-0.5}
        fontSize={0.18}
      />
      <HcSr04Module
        doNotPlace
        name="HC_SR04"
        schSectionName="Ultrasonic"
        schX={7.5}
        schY={-1.5}
        connections={{
          VCC: nets.power.v3v3.selector,
          TRIG: nets.ultrasonic.trig.selector,
          ECHO: nets.ultrasonic.echo.selector,
          GND: nets.power.gnd.selector,
        }}
      />
    </>
  )
}
