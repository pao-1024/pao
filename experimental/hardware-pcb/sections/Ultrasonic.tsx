// HC-SR04-33 的 3.3 V 版本；接口从针脚 1 到 4 为 VCC、TRIG、ECHO、GND。
// Samtec SSW-104-01-G-S：2.54 mm 节距、1.04 mm 推荐钻孔。
export function Ultrasonic() {
  return (
    <>
      <schematicsection name="Ultrasonic" displayName="超声波模组接口" />
      <connector
        name="J_US"
        manufacturerPartNumber="SSW-104-01-G-S"
        footprint={
          <footprint insertionDirection="from_above">
            {[1, 2, 3, 4].map((pin) => (
              <platedhole
                key={pin}
                shape="circle"
                portHints={[`pin${pin}`]}
                pcbX={(pin - 2.5) * 2.54}
                pcbY={0}
                holeDiameter="1.04mm"
                outerDiameter="1.8mm"
              />
            ))}
          </footprint>
        }
        pinLabels={{ pin1: "VCC", pin2: "TRIG", pin3: "ECHO", pin4: "GND" }}
        pcbX={-48}
        pcbY={28}
        schSectionName="Ultrasonic"
        connections={{
          VCC: "net.V3V3",
          TRIG: "net.US_TRIG",
          ECHO: "net.US_ECHO",
          GND: "net.GND",
        }}
      />
      <capacitor
        name="C_US"
        capacitance="100nF"
        footprint="0603"
        pcbX={-48}
        pcbY={23}
        schSectionName="Ultrasonic"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
    </>
  )
}
