import { nets } from "../nets"
import { LauncherModule } from "../components/LauncherModule"
import { RelayModule } from "../components/RelayModule"

// 发射器区只画「继电器 → 发射器」的接线。
// 专用 3.3V 由供电区的 BUCK_3V3 产生，这里通过 V3V3_AUX 网络引入并直接接到发射器：
// 发射器上电即开始充能，PAO 只控制发射。
export function Launcher() {
  return (
    <>
      <schematicsection name="Launcher" />
      {/* 此区标题手动定位在元件簇正上方，避免与相邻 OLED 分区重叠。 */}
      <schematictext
        text="电磁发射器 / 发射继电器"
        schX={-6.1}
        schY={-4.8}
        fontSize={0.18}
      />
      {/* 发射继电器：触点把发射器 FIRE 短接到 GND，等同于按下发射键。 */}
      <RelayModule
        doNotPlace
        name="RELAY_FIRE"
        schSectionName="Launcher"
        schX={-9}
        schY={-6.6}
        noConnect={["NC"]}
        connections={{
          VCC: nets.power.v3v3Aux.selector,
          COM: nets.power.gnd.selector,
          GND: nets.power.gnd.selector,
          IN: nets.launcher.fire.selector,
          NO: "LAUNCHER.FIRE",
        }}
      />
      <LauncherModule
        doNotPlace
        name="LAUNCHER"
        displayName="电磁发射器"
        schSectionName="Launcher"
        schX={-3.2}
        schY={-6.6}
        connections={{
          VCC: nets.power.v3v3Aux.selector,
          GND: nets.power.gnd.selector,
        }}
      />
      <netlabel
        net={nets.power.v3v3Aux.name}
        connection="RELAY_FIRE.VCC"
        schX={-10.6}
        schY={-6.4}
        anchorSide="right"
      />
      <netlabel
        net={nets.power.gnd.name}
        connection="RELAY_FIRE.GND"
        schX={-11.2}
        schY={-6.6}
        anchorSide="right"
      />
      <netlabel
        net={nets.power.gnd.name}
        connection="RELAY_FIRE.COM"
        schX={-7.4}
        schY={-6.6}
        anchorSide="left"
      />
      <netlabel
        net={nets.power.v3v3Aux.name}
        connection="LAUNCHER.VCC"
        schX={-5}
        schY={-6.4}
        anchorSide="right"
      />
      <netlabel
        net={nets.power.gnd.name}
        connection="LAUNCHER.GND"
        schX={-5}
        schY={-6.6}
        anchorSide="right"
      />
    </>
  )
}
