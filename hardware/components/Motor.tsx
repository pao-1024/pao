import type { PinHeaderProps } from "@tscircuit/props"

export function Motor(props: Omit<PinHeaderProps, "pinCount" | "pinLabels">) {
  return (
    <pinheader
      doNotPlace
      schFacingDirection="left"
      schSectionName="Motors"
      {...props}
      pinCount={2}
      pinLabels={{ pin1: "PLUS", pin2: "MINUS" }}
    />
  )
}
