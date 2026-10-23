import { OledModule } from "../components/Oled"

export function Display() {
  return (
    <>
      <schematicsection name="Display" displayName="05 OLED 屏幕" />
      <OledModule
        doNotPlace
        name="OLED"
        schSectionName="Display"
        schX={-11}
        schY={-3}
        connections={{
          SDA: "net.OLED_SDA",
          SCL: "net.OLED_SCL",
          VCC: "net.V3V3",
          GND: "net.GND",
        }}
      />
    </>
  )
}
