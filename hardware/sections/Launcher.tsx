import { nets } from "../nets"
import { LauncherModule } from "../components/LauncherModule"
import { RelayModule } from "../components/RelayModule"

export function Launcher() {
  return (
    <>
      <schematicsection name="Launcher" />
      {/* 此区标题手动定位，避免自动分区标题与相邻 OLED、主控重叠。 */}
      <schematictext
        text="电磁发射器 / 双继电器"
        schX={-9.5}
        schY={-4.3}
        fontSize={0.18}
      />
      {/* CH1：充能。触点把 3.3V 送到发射器供电脚，供电即开始充能。 */}
      <RelayModule
        doNotPlace
        name="RELAY_CHARGE"
        schSectionName="Launcher"
        schX={-9.5}
        schY={-5.6}
        noConnect={["NC"]}
        connections={{
          VCC: nets.power.v3v3.selector,
          GND: nets.power.gnd.selector,
          IN: nets.launcher.charge.selector,
          COM: nets.power.v3v3.selector,
          NO: "LAUNCHER.VCC",
        }}
      />
      {/* CH2：发射。触点把发射器 FIRE 短接到 GND，等同于按下发射键。 */}
      <RelayModule
        doNotPlace
        name="RELAY_FIRE"
        schSectionName="Launcher"
        schX={-9.5}
        schY={-9.6}
        noConnect={["NC"]}
        connections={{
          VCC: nets.power.v3v3.selector,
          GND: nets.power.gnd.selector,
          IN: nets.launcher.fire.selector,
          COM: nets.power.gnd.selector,
          NO: "LAUNCHER.FIRE",
        }}
      />
      <LauncherModule
        doNotPlace
        name="LAUNCHER"
        displayName="电磁发射器"
        schSectionName="Launcher"
        schX={-4.8}
        schY={-9.4}
        connections={{
          GND: nets.power.gnd.selector,
        }}
      />
    </>
  )
}
