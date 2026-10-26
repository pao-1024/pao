import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["pin2"],
  pin3: ["pin3"],
} as const

export function JS102011SAQN(props: ChipProps<typeof pinLabels>) {
  return (
    <chip
      pinLabels={pinLabels}
      manufacturerPartNumber="JS102011SAQN"
      supplierPartNumbers={{ jlcpcb: ["C221660"] }}
      footprint={
        <footprint>
          <hole pcbX="-3.400044mm" pcbY="-1.75002825mm" diameter="0.999998mm" />
          <hole pcbX="3.400044mm" pcbY="-1.75002825mm" diameter="0.999998mm" />
          <smtpad
            portHints={["pin1"]}
            pcbX="-2.499995mm"
            pcbY="1.00002975mm"
            width="1.1999976mm"
            height="2.499995mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="0mm"
            pcbY="1.00002975mm"
            width="1.1999976mm"
            height="2.499995mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="2.499995mm"
            pcbY="1.00002975mm"
            width="1.1999976mm"
            height="2.499995mm"
            shape="rect"
          />
        </footprint>
      }
      {...props}
    />
  )
}
