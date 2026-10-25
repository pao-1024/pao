import { nets } from "../nets"
import { OledModule } from "../components/Oled"

export function Display() {
  return (
    <>
      <schematicsection name="Display" />
      <schematictext text="OLED 屏幕" schX={-11} schY={-2} fontSize={0.18} />
      <OledModule
        doNotPlace
        name="OLED"
        schSectionName="Display"
        schX={-11}
        schY={-3}
        connections={{
          SDA: nets.display.sda.selector,
          SCL: nets.display.scl.selector,
          VCC: nets.power.v3v3.selector,
          GND: nets.power.gnd.selector,
        }}
      />
    </>
  )
}
