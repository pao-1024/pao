export const sensorTypes = ["mcp9808", "bh1750", "sht31"] as const;
export type SensorType = typeof sensorTypes[number];
export type SensorInput = { id: number; temperatureC?: number; humidityPercent?: number; lux?: number };
export const sensorDefinitions = {
  mcp9808: { name: "精密温度传感器", model: "Adafruit #1782 · MCP9808 · 原版八针", code: 1, currentMa: 0.4,
    source: "https://learn.adafruit.com/adafruit-mcp9808-precision-i2c-temperature-sensor-guide/pinouts",
    cad: "https://github.com/adafruit/Adafruit-MCP9808-Breakout-PCB/blob/5a46deacf915eeeb5fcafd82e214ce162bf4a464/Adafruit%20MCP9808%20Breakout.brd",
    straps: ["A0", "A1", "A2"], addresses: [24,25,26,27,28,29,30,31], metrics: ["temperatureC"],
    physicalPins: ["VIN", "GND", "SCL", "SDA", "ALERT", "A0", "A1", "A2"], width: 20.32, height: 12.7, firstX: 1.27, pinY: 10.414,
    holes: [[2.54,2.54],[17.78,2.54]],
  },
  bh1750: { name: "环境光照传感器", model: "Adafruit #4681 · BH1750", code: 2, currentMa: 0.2,
    source: "https://learn.adafruit.com/adafruit-bh1750-ambient-light-sensor/pinouts",
    cad: "https://github.com/adafruit/Adafruit-BH1750-PCB/blob/0b61eb2c8c54254a5685adc044fbf7c5ab968e56/Adafruit%20BH1750.brd",
    straps: ["ADDR"], addresses: [35,92], metrics: ["lux"],
    physicalPins: ["VIN", "3Vo", "GND", "SCL", "SDA", "ADDR"], width: 25.4, height: 17.78, firstX: 6.35, pinY: 15.24,
    holes: [[2.54,2.54],[22.86,2.54],[2.54,15.24],[22.86,15.24]],
  },
  sht31: { name: "温湿度传感器", model: "Adafruit #2857 · SHT31-D · 原版七针", code: 3, currentMa: 2,
    source: "https://learn.adafruit.com/adafruit-sht31-d-temperature-and-humidity-sensor-breakout/pinouts",
    cad: "https://github.com/adafruit/Adafruit-SHT31-Sensor-Breakout-PCB/blob/00cb07abd32b2a1bcfb4534cd69d71cc91630a36/Adafruit%20SHT31%20Breakout.brd",
    straps: ["ADR"], addresses: [68,69], metrics: ["temperatureC", "humidityPercent"],
    physicalPins: ["VIN", "GND", "SCL", "SDA", "ADR", "RST", "ALR"], width: 17.78, height: 12.7, firstX: 1.27, pinY: 10.16,
    holes: [[2.54,2.54],[15.24,2.54]],
  },
} as const;
export const isSensor = (type: string): type is SensorType => sensorTypes.includes(type as SensorType);
export const sensorMetricRanges = { temperatureC: [-40,125], humidityPercent: [0,100], lux: [0,50000] } as const;
export const sensorDefaults = { temperatureC: 25, humidityPercent: 50, lux: 100 };

export function validateSensorInputs(value: unknown): SensorInput[] {
  if (!Array.isArray(value) || value.length > 12) throw Error("传感器输入须为最多 12 项的数组");
  const ids = new Set<number>();
  return value.map((v) => {
    if (!v || !Number.isSafeInteger(v.id) || v.id < 1 || ids.has(v.id)) throw Error("传感器输入 ID 无效或重复");
    ids.add(v.id);
    const result: SensorInput = { id: v.id };
    for (const key of Object.keys(v)) if (key !== "id") {
      if (!(key in sensorMetricRanges)) throw Error("未知传感器物理量");
      const metric = key as keyof typeof sensorMetricRanges, [min,max] = sensorMetricRanges[metric];
      if (typeof v[key] !== "number" || !Number.isFinite(v[key]) || v[key] < min || v[key] > max) throw Error(`${metric} 必须为 ${min}–${max}`);
      result[metric] = v[key];
    }
    if (Object.keys(result).length < 2) throw Error("传感器输入缺少物理量");
    return result;
  });
}
