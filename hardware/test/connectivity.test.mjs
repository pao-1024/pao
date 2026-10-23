import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const circuit = JSON.parse(
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
function portName(port) {
  const name = componentNames.get(port.source_component_id)
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

// 从实际导线和板上内部连接建立网络，涵盖开发板重复的电源/地排针。
const parents = new Map()
function root(id) {
  if (!parents.has(id)) return undefined
  if (parents.get(id) !== id) parents.set(id, root(parents.get(id)))
  return parents.get(id)
}
function connect(ids) {
  for (const id of ids) if (!parents.has(id)) parents.set(id, id)
  for (const id of ids) parents.set(root(id), root(ids[0]))
}
for (const trace of traces) {
  connect([
    ...trace.connected_source_port_ids,
    ...(trace.connected_source_net_ids ?? []),
  ])
}
for (const component of components) {
  for (const group of component.internally_connected_source_port_ids ?? []) {
    connect(group)
  }
}

function port(name) {
  const result = portsByName.get(name)
  assert.ok(result, `缺少模块引脚 ${name}`)
  return result
}

function network(name) {
  const key = root(port(name).source_port_id)
  assert.ok(key, `${name} 没有连接到网络`)
  return key
}

// 核对编译后同一网络的完整成员，额外短接到任何引脚都会失败。
function assertNetwork(expected) {
  const key = network(expected[0])
  const actual = [
    ...new Set(
      ports.filter((item) => root(item.source_port_id) === key).map(portName),
    ),
  ].sort()
  assert.deepEqual(
    actual,
    [...expected].sort(),
    `${expected[0]} 的网络成员不符`,
  )
  return key
}

test("编译产物包含全部 12 个模块，且没有电路错误", () => {
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
      "MX1508",
      "MOTOR_RIGHT",
      "MOTOR_LEFT",
    ].sort(),
  )
  const mcuPorts = ports.filter(
    (item) => componentNames.get(item.source_component_id) === "ESP32_S3",
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
    components.find((item) => item.name === "BATTERY").ftype,
    "simple_power_source",
  )
  assert.equal(
    components.find((item) => item.name === "POWER_SWITCH").ftype,
    "simple_switch",
  )
  assert.deepEqual(
    circuit.filter((item) => item.type.endsWith("_error")),
    [],
  )
})

test("12 路 GPIO 与用户附件一致，每路只连接对应模块信号", () => {
  // 独立记录 reference-wiring.jpg 的接线要求，不从电路源码导入预期值。
  const connections = [
    [4, "MIC.WS"],
    [5, "MIC.SCK"],
    [6, "MIC.SD"],
    [7, "AMP.DIN"],
    [15, "AMP.BCLK"],
    [16, "AMP.LRC"],
    [41, "OLED.SDA"],
    [42, "OLED.SCL"],
    [11, "MX1508.IN1"],
    [12, "MX1508.IN2"],
    [13, "MX1508.IN3"],
    [14, "MX1508.IN4"],
  ]
  for (const [gpio, signal] of connections) {
    assertNetwork([`ESP32_S3.GPIO${gpio}`, signal])
  }
  assert.deepEqual(
    ports
      .filter(
        (item) =>
          portName(item).startsWith("ESP32_S3.GPIO") &&
          root(item.source_port_id),
      )
      .map(portName)
      .sort(),
    connections.map(([gpio]) => `ESP32_S3.GPIO${gpio}`).sort(),
  )
})

test("5V、3.3V 与公共地分配正确，功放选左声道并设置 12dB 增益", () => {
  const v5 = assertNetwork(["BOOST_5V.VOUT_PLUS", "ESP32_S3.5V", "MX1508.VCC"])
  const v3v3 = assertNetwork([
    "ESP32_S3.3V3",
    "MIC.VDD",
    "AMP.VIN",
    "AMP.SD_MODE",
    "OLED.VCC",
  ])
  const gnd = assertNetwork([
    "CHARGER_1S.OUT_MINUS",
    "BOOST_5V.VIN_MINUS",
    "BOOST_5V.VOUT_MINUS",
    "ESP32_S3.GND",
    "MIC.GND",
    "MIC.L_R",
    "AMP.GND",
    "AMP.GAIN",
    "OLED.GND",
    "MX1508.GND",
  ])
  assert.equal(new Set([v5, v3v3, gnd]).size, 3, "电源及地不能短接")
})

test("电池通过充电保护板和开关供电，保护前负极不并入系统地", () => {
  const batteryPlus = assertNetwork(["BATTERY.pin1", "CHARGER_1S.B_PLUS"])
  const batteryMinus = assertNetwork(["BATTERY.pin2", "CHARGER_1S.B_MINUS"])
  const protectedPlus = assertNetwork([
    "CHARGER_1S.OUT_PLUS",
    "POWER_SWITCH.COM",
  ])
  const switchedPlus = assertNetwork(["POWER_SWITCH.ON", "BOOST_5V.VIN_PLUS"])
  assert.equal(
    new Set([
      batteryPlus,
      batteryMinus,
      protectedPlus,
      switchedPlus,
      network("ESP32_S3.GND"),
    ]).size,
    5,
    "不得绕过保护板或直接短接开关两端",
  )
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
  const keys = outputs.map(assertNetwork)
  assert.equal(new Set(keys).size, 6, "六条输出线不得互相短接")
  const supplyKeys = ["ESP32_S3.GND", "ESP32_S3.5V", "ESP32_S3.3V3"].map(
    network,
  )
  for (const key of keys)
    assert.ok(!supplyKeys.includes(key), "输出线不得接电源或地")
})

test("省略可选按钮，三脚开关的 OFF 脚明确悬空", () => {
  for (const gpio of [0, 39, 40]) {
    assert.equal(
      root(port(`ESP32_S3.GPIO${gpio}`).source_port_id),
      undefined,
      "可选按钮 GPIO 保持未接",
    )
  }
  const unused = port("POWER_SWITCH.OFF")
  assert.equal(unused.do_not_connect, true)
  assert.equal(unused.subcircuit_connectivity_map_key, undefined)
  assert.ok(
    traces.every(
      (trace) =>
        !trace.connected_source_port_ids.includes(unused.source_port_id),
    ),
    "OFF 脚不得出现导线",
  )
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
