import { validateSensorInputs, sensorDefinitions, type SensorInput, type SensorType } from "./sensors.ts";
export type Scenario = { name: string; level: number; durationMs: number; alarm: boolean; volume: number; toneHz: number; motorA: number; motorB: number; label: string; inputs?: SensorInput[] };
export type AgentApplication = { kind: "agent"; prompt: string; summary: string; source: string; scenarios: Scenario[] };

export function validateAgentHardware(application: AgentApplication, spec: { mic: unknown; amp: unknown; motor: unknown; sensors?: { id: number; type: SensorType }[] }) {
  for (const step of application.scenarios) {
    if ((!spec.mic && (step.level || step.volume)) || (!spec.amp && (step.volume || step.toneHz)) || (!spec.motor && (step.motorA || step.motorB)))
      throw Error(`验收 ${step.name} 使用了当前接线没有的外设`);
    for (const input of step.inputs || []) {
      const sensor = spec.sensors?.find((s) => s.id === input.id);
      if (!sensor || Object.keys(input).some((key) => key !== "id" && !(sensorDefinitions[sensor.type].metrics as readonly string[]).includes(key))) throw Error(`验收 ${step.name} 使用了未接入的传感器或物理量`);
      if (step.durationMs < 750) throw Error("传感器验收至少持续 750ms，等待实际 I²C 采样");
    }
  }
  return application;
}

export const agentApi = `struct StudioOutput { int volume; int toneHz; int motorA; int motorB; bool alarm; const char *label; };
// StudioSensor studio_sensor(int moduleId) returns { bool valid; float temperatureC, humidityPercent, lux; }.
// Read current connected sensor IDs from spec.sensors. Samples update every 200ms through real I2C drivers.
// Only use metrics supported by that sensor; unsupported fields are NAN. Guard with valid before use.
// Optional scenario inputs: [{id: moduleId, temperatureC: 32, humidityPercent: 70, lux: 10}].
// Supply only supported metrics in real units (Celsius, percent RH, lux); durationMs >=750 for sensor steps.
// Implement: StudioOutput studio_step(bool running, int level, int64_t now_ms)
// Called every ~20ms. level is absolute PCM16 peak (0..32768). now_ms is monotonic guest time.
// volume: microphone passthrough 0..100%; toneHz: 0=silence or 100..2000Hz (overrides passthrough).
// motorA/B: -50..50 percent. alarm: status flag. label: string literal of 1..20 uppercase A-Z/spaces.
// motorA=30 means 30% PWM duty, NOT 30% of the safety limit (do not scale it to 15).
// alarm is independent of running/motion: leave it false unless the requirement asks for an alarm.
// Persistent state may use static locals; reset it while !running. Return zero outputs while paused.
// The platform ALREADY implements I2S RX/TX (including shared clocks), OLED drawing, and motor PWM.
// Your returned volume/toneHz/label/motor fields are applied to real guest drivers automatically.
// Do NOT implement drivers yourself. A missing motor does not prevent audio/display apps; return motorA/B=0.
// No includes, preprocessor, drivers, GPIO writes, asm, filesystem, network, allocation, threads or blocking.
// The platform supplies <algorithm>, <cmath>, <cstdint>. Use only available hardware; no invented sensors.
// Return a complete function, not markdown. Never redefine StudioOutput or app_main.
// Scenarios form an ordered test sequence from fresh startup, with constant PCM level per step.
// The platform sends app-run BEFORE the first scenario. ALL scenario steps run with running=true.
// Do not put paused/boot states in scenarios; the platform checks app-pause and zero outputs afterwards.
// Apps without input transitions may use two steady-state RUN steps. Set level=0 when no mic exists.
// Expected fields are outputs at the END of each step, not transient events. Include a baseline and a transition.`;

export const agentSchema = {
  type: "object", additionalProperties: false, required: ["summary", "source", "scenarios"], properties: {
    summary: { type: "string", maxLength: 2000 }, source: { type: "string", maxLength: 16000 }, scenarios: { type: "array", minItems: 2, maxItems: 8, items: {
      type: "object", additionalProperties: false,
      required: ["name", "level", "durationMs", "alarm", "volume", "toneHz", "motorA", "motorB", "label"],
      properties: { name: { type: "string", maxLength: 100 }, level: { type: "integer", minimum: 0, maximum: 30000 },
        durationMs: { type: "integer", minimum: 250, maximum: 2500 }, alarm: { type: "boolean" },
        volume: { type: "integer", minimum: 0, maximum: 100 }, toneHz: { type: "integer", minimum: 0, maximum: 2000 },
        motorA: { type: "integer", minimum: -50, maximum: 50 }, motorB: { type: "integer", minimum: -50, maximum: 50 },
        label: { type: "string", pattern: "^[A-Z ]{1,20}$" },
        inputs: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["id"], properties: {
          id: { type: "integer", minimum: 1 }, temperatureC: { type: "number", minimum: -40, maximum: 125 },
          humidityPercent: { type: "number", minimum: 0, maximum: 100 }, lux: { type: "number", minimum: 0, maximum: 50000 }
        } } } }
    } }
  }
};

export function validateAgent(value: unknown): AgentApplication {
  if (!value || typeof value !== "object") throw Error("Agent 应用必须为对象");
  const a = value as AgentApplication;
  for (const [key, max] of [["prompt", 4000], ["summary", 2000], ["source", 16000]] as const)
    if (typeof a[key] !== "string" || !a[key].trim() || a[key].length > max) throw Error(`Agent ${key} 为空或过长`);
  if (/^\s*#|\b(asm|__asm__|app_main|system|popen|fopen)\b/m.test(a.source)) throw Error("业务源码不能包含预处理、主入口或主机操作");
  if (!Array.isArray(a.scenarios) || a.scenarios.length < 2 || a.scenarios.length > 8) throw Error("需要 2–8 个验收步骤");
  let duration = 0;
  const scenarios = a.scenarios.map((s) => {
    if (!s || typeof s !== "object") throw Error("验收步骤无效");
    for (const [key, min, max] of [["level", 0, 30000], ["durationMs", 250, 2500], ["volume", 0, 100], ["toneHz", 0, 2000], ["motorA", -50, 50], ["motorB", -50, 50]] as const)
      if (!Number.isInteger(s[key]) || s[key] < min || s[key] > max) throw Error(`验收 ${key} 超出范围`);
    if (s.toneHz > 0 && s.toneHz < 100) throw Error("提示音至少 100Hz");
    if (typeof s.name !== "string" || !s.name.trim() || s.name.length > 100 || typeof s.alarm !== "boolean" || typeof s.label !== "string" || !/^[A-Z ]{1,20}$/.test(s.label)) throw Error("验收名称、状态或屏幕标签无效");
    duration += s.durationMs;
    return { name: s.name, level: s.level, durationMs: s.durationMs, alarm: s.alarm, volume: s.volume, toneHz: s.toneHz, motorA: s.motorA, motorB: s.motorB, label: s.label, ...(s.inputs === undefined ? {} : { inputs: validateSensorInputs(s.inputs) }) };
  });
  if (duration > 15000) throw Error("验收总时长不能超过 15 秒");
  return { kind: "agent", prompt: a.prompt, summary: a.summary, source: a.source, scenarios };
}
