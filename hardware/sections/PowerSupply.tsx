import { nets } from "../nets"
import { Boost5VModule } from "../components/Boost5V"
import { PowerSwitch } from "../components/PowerSwitch"
import { Tp4056Protection } from "../components/Tp4056"

export function PowerSupply() {
  return (
    <>
      <schematicsection name="Power" displayName="供电 / 1S → 5V" />
      <battery
        doNotPlace
        name="BATTERY"
        schSectionName="Power"
        schX={-11}
        schY={7}
        voltage="3.7V"
        schOrientation="pos_top"
        connections={{ pos: "CHARGER_1S.B_PLUS", neg: "CHARGER_1S.B_MINUS" }}
      />
      <Tp4056Protection
        doNotPlace
        name="CHARGER_1S"
        schSectionName="Power"
        noConnect={["USB_PLUS", "USB_MINUS"]}
        schX={-7}
        schY={7}
        connections={{
          OUT_PLUS: "POWER_SWITCH.COM",
          OUT_MINUS: nets.power.gnd.selector,
        }}
      />
      <netlabel
        net={nets.power.gnd.name}
        connection="CHARGER_1S.OUT_MINUS"
        schX={-5.2}
        schY={6.1}
        anchorSide="top"
      />
      <PowerSwitch
        doNotPlace
        name="POWER_SWITCH"
        schSectionName="Power"
        type="spdt"
        schX={-1.5}
        schY={7}
        pinLabels={{ pin1: "COM", pin2: "ON", pin3: "OFF" }}
        noConnect={["OFF"]}
        connections={{ ON: "BOOST_5V.VIN_PLUS" }}
      />
      <Boost5VModule
        doNotPlace
        name="BOOST_5V"
        schSectionName="Power"
        schX={3.5}
        schY={7}
        connections={{
          VIN_MINUS: nets.power.gnd.selector,
          VOUT_PLUS: nets.power.v5.selector,
          VOUT_MINUS: nets.power.gnd.selector,
        }}
      />

      <netlabel
        net={nets.power.gnd.name}
        connection="BOOST_5V.VOUT_MINUS"
        schX={5.1}
        schY={6.1}
        anchorSide="top"
      />
    </>
  )
}
