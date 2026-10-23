import { nets } from "../nets"
import { Motor } from "../components/Motor"
import { Mx1508Module } from "../components/Mx1508"

export function MotorDrive() {
  return (
    <>
      <schematicsection name="Motors" displayName="MX1508 电机驱动" />
      <Mx1508Module
        doNotPlace
        name="MX1508"
        schSectionName="Motors"
        schX={6}
        schY={-6}
        connections={{
          VCC: nets.power.v5.selector,
          GND: nets.power.gnd.selector,
          IN1: nets.motorDrive.in1.selector,
          IN2: nets.motorDrive.in2.selector,
          IN3: nets.motorDrive.in3.selector,
          IN4: nets.motorDrive.in4.selector,
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
      <Motor name="MOTOR_LEFT" displayName="左侧电机" schX={15.2} schY={-6.2} />
    </>
  )
}
