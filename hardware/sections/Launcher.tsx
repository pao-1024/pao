import { nets } from "../nets"
import { Buck3V3Module } from "../components/Buck3V3"
import { LauncherModule } from "../components/LauncherModule"
import { RelayModule } from "../components/RelayModule"

// 发射器供电自成一路：5V 降压到 3.3V 后只供继电器线圈与发射器，
// 不并到主控 3V3，避免充能脉冲拉塌开发板稳压器。
// 布局按「5V → 降压 → 继电器 → 发射器」从左到右推进，供电侧统一在左。
export function Launcher() {
  return (
    <>
      <schematicsection name="Launcher" />
      {/* 此区标题手动定位在元件簇正上方，避免与相邻 OLED 分区重叠。 */}
      <schematictext
        text="电磁发射器 / 双继电器"
        schX={-10.5}
        schY={-4.4}
        fontSize={0.18}
      />
      <Buck3V3Module
        doNotPlace
        name="BUCK_3V3"
        displayName="发射器 3.3V 降压"
        schSectionName="Launcher"
        schX={-11.5}
        schY={-7.4}
        connections={{
          VIN_PLUS: nets.power.v5.selector,
          VIN_MINUS: nets.power.gnd.selector,
          VOUT_PLUS: nets.power.v3v3Aux.selector,
          VOUT_MINUS: nets.power.gnd.selector,
        }}
      />
      {/* CH1：充能。触点把专用 3.3V 送到发射器供电脚，供电即开始充能。 */}
      <RelayModule
        doNotPlace
        name="RELAY_CHARGE"
        schSectionName="Launcher"
        schX={-7}
        schY={-5.4}
        noConnect={["NC"]}
        connections={{
          VCC: nets.power.v3v3Aux.selector,
          COM: nets.power.v3v3Aux.selector,
          GND: nets.power.gnd.selector,
          IN: nets.launcher.charge.selector,
          NO: "LAUNCHER.VCC",
        }}
      />
      {/* CH2：发射。触点把发射器 FIRE 短接到 GND，等同于按下发射键。 */}
      <RelayModule
        doNotPlace
        name="RELAY_FIRE"
        schSectionName="Launcher"
        schX={-7}
        schY={-9.2}
        noConnect={["NC"]}
        connections={{
          VCC: nets.power.v3v3Aux.selector,
          COM: nets.power.gnd.selector,
          GND: nets.power.gnd.selector,
          IN: nets.launcher.fire.selector,
          NO: "LAUNCHER.FIRE",
        }}
      />
      <netlabel
        net={nets.power.gnd.name}
        connection="LAUNCHER.GND"
        schX={-5.3}
        schY={-7.3}
        anchorSide="right"
      />
      <LauncherModule
        doNotPlace
        name="LAUNCHER"
        displayName="电磁发射器"
        schSectionName="Launcher"
        schX={-2.2}
        schY={-7.3}
        connections={{
          GND: nets.power.gnd.selector,
        }}
      />
    </>
  )
}
