declare module "*.kicad_sym" {
  const symbol: import("circuit-json").AnyCircuitElement[]
  export default symbol
}
