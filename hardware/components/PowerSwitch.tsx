import type { SwitchProps } from "@tscircuit/props"
import type { ReactElement } from "react"

export function PowerSwitch(props: SwitchProps): ReactElement {
  return <switch {...props} />
}
