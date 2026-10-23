import { Motor } from "../components/Motor"
import { Mx1508Module } from "../components/Mx1508"

export function MotorDrive() {
  return (
    <>
      <schematicsection name="Motors" displayName="06 MX1508 电机驱动" />
      <Mx1508Module
        doNotPlace
        name="MX1508"
        schSectionName="Motors"
        schX={6}
        schY={-6}
        connections={{
          VCC: "net.V5",
          GND: "net.GND",
          IN1: "net.MOTOR_IN1",
          IN2: "net.MOTOR_IN2",
          IN3: "net.MOTOR_IN3",
          IN4: "net.MOTOR_IN4",
          RIGHT_PLUS: "MOTOR_RIGHT.PLUS",
          RIGHT_MINUS: "MOTOR_RIGHT.MINUS",
          LEFT_PLUS: "MOTOR_LEFT.PLUS",
          LEFT_MINUS: "MOTOR_LEFT.MINUS",
        }}
      />
      <Motor
        name="MOTOR_RIGHT"
        displayName="右侧电机"
        schX={10.8}
        schY={-5.8}
      />
      <Motor
        name="MOTOR_LEFT"
        displayName="左侧电机"
        schX={15.2}
        schY={-6.2}
      />
    </>
  )
}
