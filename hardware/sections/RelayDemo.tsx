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
      {[1, 2].map((channel) => {
        const x = channel === 1 ? -8 : -3
        return (
          <Fragment key={channel}>
            <RelayDemoModule
              doNotPlace
              name={`RELAY_DEMO${channel}`}
              schSectionName="RelayDemo"
              schX={x - 2}
              schY={-6}
              noConnect={["NC"]}
              connections={{
                VCC: nets.power.v3v3.selector,
                GND: nets.power.gnd.selector,
                IN:
                  channel === 1
                    ? nets.relayDemo.ch1.selector
                    : nets.relayDemo.ch2.selector,
                COM: nets.power.v5.selector,
                NO: `R_DEMO${channel}.pin1`,
              }}
            />
            <netlabel
              net={nets.power.gnd.name}
              connection={`RELAY_DEMO${channel}.GND`}
              schX={x - 3.5}
              schY={-6}
              anchorSide="right"
            />
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
