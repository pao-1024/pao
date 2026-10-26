import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["D4"],
  pin2: ["D5"],
  pin3: ["G"],
  pin4: ["S2"],
  pin5: ["D2"],
  pin6: ["D3"],
  pin7: ["D1"],
  pin8: ["S1"],
} as const

export function CSD16301Q2(props: ChipProps<typeof pinLabels>) {
  return (
    <chip
      pinLabels={pinLabels}
      manufacturerPartNumber="CSD16301Q2"
      supplierPartNumbers={{ jlcpcb: ["C140340"] }}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin7"]}
            pcbX="-0.34206815mm"
            pcbY="-0mm"
            width="0.9500108mm"
            height="0.999998mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin8"]}
            pcbX="0.63293625mm"
            pcbY="0.094996mm"
            width="0.3683mm"
            height="0.7500112mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin4"]}
            pcbX="0.63293625mm"
            pcbY="0.9750044mm"
            width="0.2999994mm"
            height="0.4500118mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin5"]}
            pcbX="-0.01707515mm"
            pcbY="0.9750044mm"
            width="0.2999994mm"
            height="0.4500118mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin6"]}
            pcbX="-0.66708655mm"
            pcbY="0.9750044mm"
            width="0.2999994mm"
            height="0.4500118mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="0.63293625mm"
            pcbY="-0.9750044mm"
            width="0.2999994mm"
            height="0.4500118mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin1"]}
            pcbX="-0.66708655mm"
            pcbY="-0.9750044mm"
            width="0.2999994mm"
            height="0.4500118mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="-0.01707515mm"
            pcbY="-0.9750044mm"
            width="0.2999994mm"
            height="0.4500118mm"
            shape="rect"
          />
        </footprint>
      }
      {...props}
    />
  )
}
