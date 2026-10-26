// JST PH 2.0 mm 精确插针孔位；插入方向为板面上方。
export const jstPh3Footprint = (
  <footprint insertionDirection="from_above">
    <platedhole
      portHints={["pin2"]}
      pcbX="0mm"
      pcbY="-0.550037mm"
      outerDiameter="1.5999968mm"
      holeDiameter="0.999998mm"
      shape="circle"
    />
    <platedhole
      portHints={["pin1"]}
      pcbX="1.999996mm"
      pcbY="-0.550037mm"
      outerDiameter="1.5999968mm"
      holeDiameter="0.999998mm"
      shape="circle"
    />
    <platedhole
      portHints={["pin3"]}
      pcbX="-1.999996mm"
      pcbY="-0.550037mm"
      outerDiameter="1.5999968mm"
      holeDiameter="0.999998mm"
      shape="circle"
    />
  </footprint>
)
