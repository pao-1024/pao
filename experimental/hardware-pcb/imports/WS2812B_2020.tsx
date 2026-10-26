import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["DO"],
  pin2: ["GND"],
  pin3: ["DI"],
  pin4: ["VDD"],
} as const

export function WS2812B_2020(props: ChipProps<typeof pinLabels>) {
  return (
    <chip
      pinLabels={pinLabels}
      manufacturerPartNumber="WS2812B-2020"
      supplierPartNumbers={{ jlcpcb: ["C965555"] }}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX="-0.915035mm"
            pcbY="0.550037mm"
            width="0.8999982mm"
            height="0.6999986mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="-0.915035mm"
            pcbY="-0.550037mm"
            width="0.8999982mm"
            height="0.6999986mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="0.915035mm"
            pcbY="-0.550037mm"
            width="0.8999982mm"
            height="0.6999986mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin4"]}
            pcbX="0.915035mm"
            pcbY="0.550037mm"
            width="0.8999982mm"
            height="0.6999986mm"
            shape="rect"
          />
        </footprint>
      }
      {...props}
    />
  )
}
