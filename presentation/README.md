# PAO 决赛演示稿

这份 [Slidev](https://sli.dev/guide/) 演示稿以 **探索 Agent 时代的硬件开发新范式** 为主题，按[10 分钟答辩大纲](../docs/final-presentation-outline.md)编排为十三页，统一使用白底。第 2 页总览三类核心设计：电路 · tscircuit、嵌入式软件 · ESP-IDF + esp32sim、机械结构 · Blender，尝试让 Agent 参与全流程，仿真、测试与评估贯穿三者。第 3、4 页说明如何将软件工程已有的版本管理与 PR 协作方式延伸到硬件，让硬件工程资产可追溯、可复用、可重建，电路和固件一起审查。随后用评估闭环和各环节的实际工程展开说明，区分已有实现与当前研发状态。

硬件工程资产页列出实际电路、固件、仿真与测试路径，评估示例包括 `hardware/test/connectivity.test.ts` 和 `experimental/platform/runtime.test.mjs`。PR 案例复用 [#36](https://github.com/pao-1024/pao/pull/36)（`9966479`）中 [Controller.tsx](../hardware/sections/Controller.tsx) 新增 GPIO8 / GPIO9 接线的真实差异，结合 Hardware 的连通性与图纸一致性检查。临时生成工程需整理后入库，CI 检查与实际 SIL、Blender 仿真和实机验收分别说明，范围见[大纲](../docs/final-presentation-outline.md)。

第 6 页将 [Display.tsx](../hardware/sections/Display.tsx) 的真实 `OledModule` 代码与[原始原理图](../hardware/schematic.svg) OLED 局部放在同页，注明省略布局属性；第 7 页展开现有[连通性测试](../hardware/test/connectivity.test.ts)的 OLED 接线断言，解释完整网络成员比较与实际 / 预期反馈，并区分实验短接和 PCB 制造 DRC；第 8 页展示原理图全图与原图链接，说明 TSX 生成的 SVG 供人审查、Circuit JSON 供工具检查。机械结构页保持流程示意，涵盖外壳、底盘、支架与装配，说明当前 Blender 研发中的 Agent 建模与刚体仿真评估。

电路章节突出 **tscircuit**。第 9 页展开嵌入式软件的运行评估，复用 [PAO 参考模拟器实际界面](../simulator/images/simulator-overview.png)，以 **esp32sim** 的芯片透明性与行为验收说明自动评估能力；**ESP-IDF** 构建作为正式固件的输入简述，构建成功后仍需验证运行行为。

代码让 Agent 能动手，评估函数让 Agent 知道是否做对，模拟器让评估可自动执行。演示稿先讲 PAO 验证的工程路径与实机行为，再进入未来展望：PAO Studio 将已有实验机制发展为可复用工作台。Studio 页面展示本地实验原型，表达产品化方向。

在 Studio 展望之后，第 13 页以“未来展望：把硬件工作流封装为 Skill。”收尾，按“当前 · PAO 验证 → 下一步 · 工作流打磨 → 未来 · Skill 封装”展开：当前用 PAO 做实验性验证，后续打磨工具接口、评估规则与失败修复，再封装为可复用的 Skill。机械建模与刚体仿真作为当前研发单独讲述，不作为未来规划或实机验收结论。能力状态与推进目标见[平台规划](../docs/platform-roadmap.md)。正文、排版和讲者备注分别维护在 `slides.md`、`style.css` 和 Markdown 注释里。

实车照片复用仓库的 `assets` release，模拟器与 Studio 截图复用仓库素材。`prepare-assets.sh` 将下载素材缓存到本 worktree 的 `tmp/presentation-assets/`，再准备本目录的 `public/` 资源；原理图直接复制仓库的 `hardware/schematic.svg`，不重绘或重复提交。该图展示模块接线，不代表 PCB 或实物验收通过。

需要 Node.js 22.12+、pnpm 和已登录并可读取本仓库 release 的 GitHub CLI。在本目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 <http://localhost:4174/>。方向键或空格翻页，Slidev 的讲者模式可查看每页备注；`pnpm build` 生成可托管的静态演示稿到 `dist/`。需要 PDF 时运行 `pnpm export`，首次使用需按 Slidev 的[导出说明](https://sli.dev/guide/exporting)准备浏览器依赖。

实车与模拟器视频使用 GitHub 附件，仓库页面及相关素材需要有访问权限的 GitHub 登录会话，现场演示前确认可播放。内容与验证边界见[大纲](../docs/final-presentation-outline.md)。

主稿使用三张 Mermaid 流程图：[pr-review.mmd](pr-review.mmd) 表达硬件变更、工具检查与人工审查，[agent-loop.mmd](agent-loop.mmd) 表达 Agent 生成、评估与错误反馈闭环，[mechanical-loop.mmd](mechanical-loop.mmd) 表达 Agent 驱动 Blender 建模与刚体仿真评估的工作流。[architecture.mmd](architecture.mmd) 保留为补充资源，表达正式固件在芯片与外设模型中运行并输出证据的路径。各图的 SVG 位于 `public/`，更新源码后用 Mermaid CLI 重新生成：

```sh
mmdc -i pr-review.mmd -o public/pr-review.svg -c mermaid-config.json -b transparent
mmdc -i agent-loop.mmd -o public/agent-loop.svg -c mermaid-config.json -b transparent
mmdc -i architecture.mmd -o public/architecture.svg -c mermaid-config.json -b transparent
mmdc -i mechanical-loop.mmd -o public/mechanical-loop.svg -c mermaid-config.json -b transparent
```
