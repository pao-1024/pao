import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["NC"],
  pin2: ["COUT"],
  pin3: ["DOUT"],
  pin4: ["VSS"],
  pin5: ["BAT"],
  pin6: ["V_NEG"],
} as const

export function BQ29700DSER(props: ChipProps<typeof pinLabels>) {
  return (
    <chip
      pinLabels={pinLabels}
      manufacturerPartNumber="BQ29700DSER"
      supplierPartNumbers={{ jlcpcb: ["C183096"] }}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX="-0.581025mm"
            pcbY="0.499999mm"
            width="0.8400034mm"
            height="0.2800096mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="-0.636143mm"
            pcbY="0.000127mm"
            width="0.7500112mm"
            height="0.2800096mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="-0.636143mm"
            pcbY="-0.499999mm"
            width="0.7500112mm"
            height="0.2800096mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin4"]}
            pcbX="0.636143mm"
            pcbY="-0.499999mm"
            width="0.7500112mm"
            height="0.2800096mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin5"]}
            pcbX="0.636143mm"
            pcbY="0.000127mm"
            width="0.7500112mm"
            height="0.2800096mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin6"]}
            pcbX="0.636143mm"
            pcbY="0.499999mm"
            width="0.7500112mm"
            height="0.2800096mm"
            shape="rect"
          />
        </footprint>
      }
      {...props}
    />
  )
}
