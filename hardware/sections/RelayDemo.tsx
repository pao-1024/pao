import { Fragment } from "react"
import { RelayDemoModule } from "../components/RelayDemoModule"
import { nets } from "../nets"

export function RelayDemo() {
  return (
    <>
      <schematicsection name="RelayDemo" />
      {/* 此区标题手动定位，避免自动分区标题与相邻 OLED 重叠。 */}
      <schematictext
        text="双继电器 / 低压 LED 演示"
        schX={-8}
        schY={-4.5}
        fontSize={0.18}
      />
      <RelayDemoModule
        doNotPlace
        name="RELAY_DEMO"
        schSectionName="RelayDemo"
        schX={-10}
        schY={-6}
        noConnect={["NC1", "NC2"]}
        connections={{
          VCC: nets.power.v5.selector,
          GND: nets.power.gnd.selector,
          CH1: nets.relayDemo.ch1.selector,
          CH2: nets.relayDemo.ch2.selector,
          COM1: nets.power.v5.selector,
          NO1: "R_DEMO1.pin1",
          COM2: nets.power.v5.selector,
          NO2: "R_DEMO2.pin1",
        }}
      />
      {[1, 2].map((channel) => {
        const x = channel === 1 ? -6.5 : -3.5
        return (
          <Fragment key={channel}>
            <resistor
              doNotPlace
              name={`R_DEMO${channel}`}
              schSectionName="RelayDemo"
              resistance="1k"
              schX={x}
              schY={-7}
              schRotation={-90}
              connections={{ pin2: `LED_DEMO${channel}.anode` }}
            />
            <led
              doNotPlace
              name={`LED_DEMO${channel}`}
              schSectionName="RelayDemo"
              color={channel === 1 ? "green" : "red"}
              schX={x}
              schY={-9}
              schRotation={-90}
              connections={{ cathode: nets.power.gnd.selector }}
            />
          </Fragment>
        )
      })}
    </>
  )
}
