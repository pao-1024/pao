import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["D1"],
  pin2: ["D2"],
  pin3: ["D3"],
  pin4: ["G"],
  pin5: ["S4"],
  pin6: ["S3"],
  pin7: ["S2"],
  pin8: ["S1"],
  pin9: ["S5"],
} as const

export const CSD25402Q3A = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
        jlcpcb: ["C111356"],
      }}
      manufacturerPartNumber="CSD25402Q3A"
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX="-1.000252mm"
            pcbY="-1.4784705mm"
            width="0.2999994mm"
            height="0.6800088mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="-0.350266mm"
            pcbY="-1.4784705mm"
            width="0.2999994mm"
            height="0.6800088mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="0.299974mm"
            pcbY="-1.4784705mm"
            width="0.2999994mm"
            height="0.6800088mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin4"]}
            pcbX="0.949706mm"
            pcbY="-1.4784705mm"
            width="0.2999994mm"
            height="0.6800088mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin8"]}
            pcbX="-0.975106mm"
            pcbY="1.5184755mm"
            width="0.2999994mm"
            height="0.5999988mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin7"]}
            pcbX="-0.32512mm"
            pcbY="1.5184755mm"
            width="0.2999994mm"
            height="0.5999988mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin6"]}
            pcbX="0.324866mm"
            pcbY="1.5184755mm"
            width="0.2999994mm"
            height="0.5999988mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin5"]}
            pcbX="0.974852mm"
            pcbY="1.5184755mm"
            width="0.2999994mm"
            height="0.5999988mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin9"]}
            pcbX="0mm"
            pcbY="0.4265295mm"
            width="2.6500074mm"
            height="1.999996mm"
            shape="rect"
          />
        </footprint>
      }
      {...props}
    />
  )
}
