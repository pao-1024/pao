import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { AnyCircuitElement, SourcePort } from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

const circuit: AnyCircuitElement[] = JSON.parse(
  readFileSync(new URL("../dist/index/circuit.json", import.meta.url), "utf8"),
)
const components = circuit.filter((item) => item.type === "source_component")
const ports = circuit.filter((item) => item.type === "source_port")
const traces = circuit.filter((item) => item.type === "source_trace")
const componentNames = new Map(
  components.map((component) => [
    component.source_component_id,
    component.name,
  ]),
)
// 原生 KiCad 符号保留物理引脚；测试统一使用接线表中的逻辑名称。
function portName(port: SourcePort): string {
  assert.ok(port.source_component_id, `引脚 ${port.source_port_id} 缺少模块 ID`)
  const name = componentNames.get(port.source_component_id)
  assert.ok(name, `引脚 ${port.source_port_id} 对应的模块不存在`)
  const hints = port.port_hints ?? []
  if (name === "ESP32_S3") {
    const gpio = hints.find((hint) => /^GPIO\d+$/.test(hint))
    return `${name}.${gpio ?? port.name}`
  }
  if (["SPEAKER", "MOTOR_RIGHT", "MOTOR_LEFT"].includes(name)) {
    return `${name}.${port.pin_number === 1 ? "PLUS" : "MINUS"}`
  }
  return `${name}.${port.name}`
}
const portsByName = new Map(ports.map((port) => [portName(port), port]))

// 复用上游连通性工具，包含导线、命名网络和板上内部连接。
const connectivity = getSourcePortConnectivityMapFromCircuitJson(circuit)

function port(name: string): SourcePort {
  const result = portsByName.get(name)
  assert.ok(result, `缺少模块引脚 ${name}`)
  return result
}

// 核对编译后同一网络的完整成员，额外短接到任何引脚都会失败。
function assertNetwork(expected: readonly string[]): void {
  const key = connectivity.getNetConnectedToId(port(expected[0]).source_port_id)
  assert.ok(key, `${expected[0]} 没有连接到网络`)
  const actual = [
    ...new Set(
      ports
        .filter(
          (item) =>
            connectivity.getNetConnectedToId(item.source_port_id) === key,
        )
        .map(portName),
    ),
  ].sort()
  assert.deepEqual(
    actual,
    [...expected].sort(),
    `${expected[0]} 的网络成员不符`,
  )
}

test("编译产物包含全部模块，且没有电路错误", () => {
  assert.deepEqual(
    components.map((component) => component.name).sort(),
    [
      "BATTERY",
      "CHARGER_1S",
      "POWER_SWITCH",
      "BOOST_5V",
      "ESP32_S3",
      "MIC",
      "AMP",
      "SPEAKER",
      "OLED",
      "HC_SR04",
      "MX1508",
      "MOTOR_RIGHT",
      "MOTOR_LEFT",
      "RELAY_FIRE",
      "BUCK_3V3",
      "LAUNCHER",
    ].sort(),
  )
  const mcuPorts = ports.filter((item) =>
    portName(item).startsWith("ESP32_S3."),
  )
  assert.equal(mcuPorts.length, 44, "保留官方开发板完整的 44 个物理引脚")
  assert.equal(new Set(mcuPorts.map((item) => item.pin_number)).size, 44)
  assert.ok(
    circuit.some(
      (item) =>
        item.type === "schematic_component" &&
        item.symbol_name === "speaker_horz",
    ),
  )
  assert.equal(
    components.find((item) => item.name === "BATTERY")?.ftype,
    "simple_power_source",
  )
  assert.equal(
    components.find((item) => item.name === "POWER_SWITCH")?.ftype,
    "simple_switch",
  )
  assert.deepEqual(
    circuit.filter((item) => item.type.endsWith("_error")),
    [],
  )
})

test("15 路外接 GPIO 与接线要求一致，每路只连接对应模块信号", () => {
  // 独立记录接线要求，不从电路源码导入预期值。
  const connections: [number, string][] = [
    [4, "MIC.WS"],
    [5, "MIC.SCK"],
    [6, "MIC.SD"],
    [7, "AMP.DIN"],
    [15, "AMP.BCLK"],
    [16, "AMP.LRC"],
    [41, "OLED.SDA"],
    [42, "OLED.SCL"],
    [8, "HC_SR04.TRIG"],
    [9, "HC_SR04.ECHO"],
    [11, "MX1508.IN1"],
    [12, "MX1508.IN2"],
    [13, "MX1508.IN3"],
    [14, "MX1508.IN4"],
    [18, "RELAY_FIRE.IN"],
  ]
  for (const [gpio, signal] of connections) {
    assertNetwork([`ESP32_S3.GPIO${gpio}`, signal])
  }
  // 板载 BOOT 与状态灯只挂标签，不接外部器件，因此不进上面的成对断言。
  assert.deepEqual(
    ports
      .filter(
        (item) =>
          portName(item).startsWith("ESP32_S3.GPIO") &&
          connectivity.getNetConnectedToId(item.source_port_id),
      )
      .map(portName)
      .sort(),
    [
      ...connections.map(([gpio]) => `ESP32_S3.GPIO${gpio}`),
      "ESP32_S3.GPIO0",
      "ESP32_S3.GPIO48",
    ].sort(),
  )
})

test("板载 BOOT 按键与 WS2812 状态灯已标出，且不引外部接线", () => {
  for (const name of ["ESP32_S3.GPIO0", "ESP32_S3.GPIO48"]) {
    const pin = port(name)
    const key = connectivity.getNetConnectedToId(pin.source_port_id)
    assert.ok(key, `${name} 应有网络标签`)
    const members = ports
      .filter(
        (item) => connectivity.getNetConnectedToId(item.source_port_id) === key,
      )
      .map(portName)
    assert.deepEqual(members, [name], `${name} 只应有板载标签`)
  }
})

test("5V、3.3V 与公共地分配正确，功放选左声道并设置 12dB 增益", () => {
  assertNetwork([
    "BOOST_5V.VOUT_PLUS",
    "ESP32_S3.5V",
    "MX1508.VCC",
    "BUCK_3V3.VIN_PLUS",
  ])
  // 主控 3V3 不再挂继电器与发射器，避免充能脉冲拉塌开发板稳压器。
  assertNetwork([
    "ESP32_S3.3V3",
    "MIC.VDD",
    "AMP.VIN",
    "AMP.SD_MODE",
    "OLED.VCC",
    "HC_SR04.VCC",
  ])
  // 发射器专用 3.3V：降压输出供继电器线圈与发射器本身，发射器常供电持续充能。
  assertNetwork(["BUCK_3V3.VOUT_PLUS", "RELAY_FIRE.VCC", "LAUNCHER.VCC"])
  assertNetwork([
    "CHARGER_1S.OUT_MINUS",
    "BOOST_5V.VIN_MINUS",
    "BOOST_5V.VOUT_MINUS",
    "ESP32_S3.GND",
    "MIC.GND",
    "MIC.L_R",
    "AMP.GND",
    "AMP.GAIN",
    "OLED.GND",
    "HC_SR04.GND",
    "MX1508.GND",
    "RELAY_FIRE.GND",
    "RELAY_FIRE.COM",
    "LAUNCHER.GND",
    "BUCK_3V3.VIN_MINUS",
    "BUCK_3V3.VOUT_MINUS",
  ])
})

test("电池通过充电保护板和开关供电，保护前负极不并入系统地", () => {
  assertNetwork(["BATTERY.pin1", "CHARGER_1S.B_PLUS"])
  assertNetwork(["BATTERY.pin2", "CHARGER_1S.B_MINUS"])
  assertNetwork(["CHARGER_1S.OUT_PLUS", "POWER_SWITCH.COM"])
  assertNetwork(["POWER_SWITCH.ON", "BOOST_5V.VIN_PLUS"])
})

test("扬声器与两组电机的输出各自独立，不接电源或地", () => {
  const outputs = [
    ["AMP.OUT_PLUS", "SPEAKER.PLUS"],
    ["AMP.OUT_MINUS", "SPEAKER.MINUS"],
    ["MX1508.RIGHT_PLUS", "MOTOR_RIGHT.PLUS"],
    ["MX1508.RIGHT_MINUS", "MOTOR_RIGHT.MINUS"],
    ["MX1508.LEFT_PLUS", "MOTOR_LEFT.PLUS"],
    ["MX1508.LEFT_MINUS", "MOTOR_LEFT.MINUS"],
  ]
  outputs.forEach(assertNetwork)
})

test("发射器按黑盒模块接线，对外只有供电、发射与地三根线", () => {
  // 发射器由专用 3.3V 常供电，充能不受继电器控制。
  const vccKey = connectivity.getNetConnectedToId(
    port("LAUNCHER.VCC").source_port_id,
  )
  const vccMembers = ports
    .filter(
      (item) =>
        connectivity.getNetConnectedToId(item.source_port_id) === vccKey,
    )
    .map(portName)
  assert.ok(vccKey, "LAUNCHER.VCC 应接到专用 3.3V")
  assert.ok(
    vccMembers.every((name) => !/^RELAY_\w+\.(NO|NC|COM)$/.test(name)),
    "发射器供电不得经过继电器触点",
  )
  // 发射继电器触点把发射按钮短接到地，等同于按下发射键。
  assertNetwork(["RELAY_FIRE.NO", "LAUNCHER.FIRE"])

  // 内部升压、储能与放电开关不展开，模块引脚固定为三个。
  assert.deepEqual(
    ports
      .filter((item) => portName(item).startsWith("LAUNCHER."))
      .map(portName)
      .sort(),
    ["LAUNCHER.FIRE", "LAUNCHER.GND", "LAUNCHER.VCC"],
  )
})

test("三脚开关的 OFF 脚及发射继电器的常闭触点明确悬空", () => {
  for (const name of ["POWER_SWITCH.OFF", "RELAY_FIRE.NC"]) {
    const unused = port(name)
    assert.equal(unused.do_not_connect, true)
    assert.equal(unused.subcircuit_connectivity_map_key, undefined)
    assert.ok(
      traces.every(
        (trace) =>
          !trace.connected_source_port_ids.includes(unused.source_port_id),
      ),
      `${name} 不得出现导线`,
    )
  }
})

test("原理图标注完整，所有内容均在图纸内", () => {
  assert.deepEqual(
    circuit.filter((item) =>
      [
        "schematic_element_outside_sheet_warning",
        "schematic_component_styling_warning",
      ].includes(item.type),
    ),
    [],
  )
})
