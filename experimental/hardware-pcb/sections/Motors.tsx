import { jstPh2Footprint } from "../imports/B2B_PH_K_S_LF__SN_"
import { drv8833Footprint } from "../imports/DRV8833RTYR"

export function Motors() {
  return (
    <>
      <schematicsection name="Motors" displayName="双路直流电机" />
      <chip
        name="U_MOTOR"
        manufacturerPartNumber="DRV8833RTYR"
        supplierPartNumbers={{ jlcpcb: ["C154936"] }}
        footprint={drv8833Footprint}
        pinLabels={{
          pin1: "AISEN",
          pin2: "AOUT2",
          pin3: "BOUT2",
          pin4: "BISEN",
          pin5: "BOUT1",
          pin6: "NFAULT",
          pin7: "BIN1",
          pin8: "BIN2",
          pin9: "VCP",
          pin10: "VM",
          pin11: "GND",
          pin12: "VINT",
          pin13: "AIN2",
          pin14: "AIN1",
          pin15: "NSLEEP",
          pin16: "AOUT1",
          pin17: "EP",
        }}
        noConnect={["NFAULT"]}
        pcbX={28}
        pcbY={-16}
        schX={14}
        schY={-28}
        schSectionName="Motors"
        connections={{
          AISEN: "net.GND",
          AOUT2: "net.MOTOR_R_N",
          BOUT2: "net.MOTOR_L_N",
          BISEN: "net.GND",
          BOUT1: "net.MOTOR_L_P",
          BIN1: "net.MOTOR_IN3",
          BIN2: "net.MOTOR_IN4",
          VCP: "net.MOTOR_VCP",
          VINT: "net.MOTOR_VINT",
          VM: "net.V5",
          GND: "net.GND",
          AIN2: "net.MOTOR_IN2",
          AIN1: "net.MOTOR_IN1",
          NSLEEP: "net.V3V3",
          AOUT1: "net.MOTOR_R_P",
          EP: "net.GND",
        }}
      />
      <capacitor
        name="C_MOTOR_VM"
        capacitance="22uF"
        footprint="1206"
        pcbX={22}
        pcbY={-14}
        schSectionName="Motors"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MOTOR_VM2"
        capacitance="100nF"
        footprint="0603"
        pcbX={22}
        pcbY={-18}
        schSectionName="Motors"
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MOTOR_VINT"
        capacitance="2.2uF"
        footprint="0603"
        pcbX={32}
        pcbY={-11}
        schSectionName="Motors"
        connections={{ pin1: "net.MOTOR_VINT", pin2: "net.GND" }}
      />
      <capacitor
        name="C_MOTOR_VCP"
        capacitance="10nF"
        footprint="0603"
        pcbX={34}
        pcbY={-15}
        schRotation={-90}
        schSectionName="Motors"
        connections={{ pin1: "net.MOTOR_VCP", pin2: "net.V5" }}
      />
      <connector
        name="J_MOTOR_R"
        manufacturerPartNumber="B2B-PH-K-S(LF)(SN)"
        supplierPartNumbers={{ jlcpcb: ["C131337"] }}
        footprint={jstPh2Footprint}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        pcbX={50}
        pcbY={-14}
        schX={25}
        schY={-26}
        schSectionName="Motors"
        connections={{ PLUS: "net.MOTOR_R_P", MINUS: "net.MOTOR_R_N" }}
      />
      <connector
        name="J_MOTOR_L"
        manufacturerPartNumber="B2B-PH-K-S(LF)(SN)"
        supplierPartNumbers={{ jlcpcb: ["C131337"] }}
        footprint={jstPh2Footprint}
        pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
        pcbX={50}
        pcbY={-28}
        schX={25}
        schY={-32}
        schSectionName="Motors"
        connections={{ PLUS: "net.MOTOR_L_P", MINUS: "net.MOTOR_L_N" }}
      />
    </>
  )
}
