import type {
  BoardProps,
  CapacitorProps,
  ChipProps,
  ConnectorProps,
  CopperPourProps,
  CrystalProps,
  FootprintProps,
  InductorProps,
  LedProps,
  PushButtonProps,
  ResistorProps,
  SchematicSectionProps,
  SchematicSheetProps,
  SmtPadProps,
  TraceProps,
  SwitchProps,
  HoleProps,
  PlatedHoleProps,
} from "@tscircuit/props"
import "react/jsx-runtime"
import type { Key } from "react"

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      board: BoardProps
      capacitor: CapacitorProps
      chip: ChipProps
      connector: ConnectorProps
      copperpour: CopperPourProps
      crystal: CrystalProps
      footprint: FootprintProps
      hole: HoleProps
      platedhole: PlatedHoleProps & { key?: Key }
      inductor: InductorProps
      led: LedProps
      pushbutton: PushButtonProps
      resistor: ResistorProps
      schematicsheet: SchematicSheetProps
      schematicsection: SchematicSectionProps
      smtpad: SmtPadProps & { key?: Key }
      trace: TraceProps
      switch: SwitchProps
    }
  }
}
