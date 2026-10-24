import { Esp32S3DevKitC1 } from "../components/Esp32S3"
import { nets } from "../nets"

export function Controller() {
  return (
    <>
      <schematicsection name="Controller" displayName="ESP32-S3 主控" />
      <Esp32S3DevKitC1
        doNotPlace
        name="ESP32_S3"
        schSectionName="Controller"
        schX={-2}
        schY={0}
        connections={{
          "5V": nets.power.v5.selector,
          "3V3": nets.power.v3v3.selector,
          GND: nets.power.gnd.selector,
          GPIO4: nets.microphone.ws.selector,
          GPIO5: nets.microphone.sck.selector,
          GPIO6: nets.microphone.sd.selector,
          GPIO7: nets.audioOutput.din.selector,
          GPIO15: nets.audioOutput.bclk.selector,
          GPIO16: nets.audioOutput.lrc.selector,
          GPIO41: nets.display.sda.selector,
          GPIO42: nets.display.scl.selector,
          GPIO11: nets.motorDrive.in1.selector,
          GPIO12: nets.motorDrive.in2.selector,
          GPIO13: nets.motorDrive.in3.selector,
          GPIO14: nets.motorDrive.in4.selector,
          GPIO17: nets.launcher.charge.selector,
          GPIO18: nets.launcher.fire.selector,
        }}
      />
    </>
  )
}
