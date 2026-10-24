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
      "MX1508",
      "MOTOR_RIGHT",
      "MOTOR_LEFT",
      "RELAY_DEMO",
      "R_DEMO1",
      "R_DEMO2",
      "LED_DEMO1",
      "LED_DEMO2",
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

test("14 路 GPIO 与接线要求一致，每路只连接对应模块信号", () => {
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
    [11, "MX1508.IN1"],
    [12, "MX1508.IN2"],
    [13, "MX1508.IN3"],
    [14, "MX1508.IN4"],
    [17, "RELAY_DEMO.CH1"],
    [18, "RELAY_DEMO.CH2"],
  ]
  for (const [gpio, signal] of connections) {
    assertNetwork([`ESP32_S3.GPIO${gpio}`, signal])
  }
  assert.deepEqual(
    ports
      .filter(
        (item) =>
          portName(item).startsWith("ESP32_S3.GPIO") &&
          connectivity.getNetConnectedToId(item.source_port_id),
      )
      .map(portName)
      .sort(),
    connections.map(([gpio]) => `ESP32_S3.GPIO${gpio}`).sort(),
  )
})

test("5V、3.3V 与公共地分配正确，功放选左声道并设置 12dB 增益", () => {
  assertNetwork([
    "BOOST_5V.VOUT_PLUS",
    "ESP32_S3.5V",
    "MX1508.VCC",
    "RELAY_DEMO.VCC",
    "RELAY_DEMO.COM1",
    "RELAY_DEMO.COM2",
  ])
  assertNetwork([
    "ESP32_S3.3V3",
    "MIC.VDD",
    "AMP.VIN",
    "AMP.SD_MODE",
    "OLED.VCC",
  ])
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
    "MX1508.GND",
    "RELAY_DEMO.GND",
    "LED_DEMO1.pin2",
    "LED_DEMO2.pin2",
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

test("每路继电器常开触点只连接独立的限流电阻和 LED", () => {
  for (const channel of [1, 2]) {
    assertNetwork([`RELAY_DEMO.NO${channel}`, `R_DEMO${channel}.pin1`])
    assertNetwork([`R_DEMO${channel}.pin2`, `LED_DEMO${channel}.pin1`])
    const resistor = components.find((item) => item.name === `R_DEMO${channel}`)
    assert.ok(resistor?.ftype === "simple_resistor")
    assert.equal(resistor.resistance, 1000)
  }
})

test("三脚开关的 OFF 脚及继电器的常闭触点明确悬空", () => {
  for (const name of ["POWER_SWITCH.OFF", "RELAY_DEMO.NC1", "RELAY_DEMO.NC2"]) {
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
