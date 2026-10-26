import type { InductorProps } from "@tscircuit/props"

export function XFL4020_222MEC(props: Omit<InductorProps, "inductance">) {
  return (
    <inductor
      inductance="2.2uH"
      manufacturerPartNumber="XFL4020-222MEC"
      supplierPartNumbers={{ jlcpcb: ["C122469"] }}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX="-1.18491mm"
            pcbY="0mm"
            width="1.39mm"
            height="3.4mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="1.18491mm"
            pcbY="0mm"
            width="1.39mm"
            height="3.4mm"
            shape="rect"
          />
        </footprint>
      }
      {...props}
    />
  )
}
