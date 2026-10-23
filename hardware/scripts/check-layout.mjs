import { spawnSync } from "node:child_process"

// 固定版本的 schematic-placement 会报告问题但仍返回 0，补齐 CI 退出状态。
for (const check of ["schematic-placement", "placement"]) {
  const result = spawnSync(
    "tsci",
    ["check", check, "dist/index/circuit.json"],
    {
      encoding: "utf8",
    },
  )
  if (result.error) throw result.error
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  if (
    result.status !== 0 ||
    result.stdout.includes("<SchematicPlacementIssues>")
  ) {
    process.exit(result.status || 1)
  }
}
