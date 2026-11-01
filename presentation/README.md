# PAO 决赛演示稿

这份 [Slidev](https://sli.dev/guide/) 演示稿以 **探索 Agent 时代的硬件开发新范式** 为主题，按[10 分钟答辩大纲](../docs/final-presentation-outline.md)编排为十三页，统一使用白底。第 2 页总览电路、固件、运行与机械结构的 Agent 自动化；第 3、4 页说明工程资产入库带来的追溯、复用与重建，以及 PR 中设计和验证的共同审查。随后用评估闭环和各环节的实际工程展开说明，区分已有实现与当前研发状态。

工程资产页列出实际电路、固件、仿真与测试路径，评估示例包括 `hardware/test/connectivity.test.ts` 和 `experimental/platform/runtime.test.mjs`。PR 案例复用 [#36](https://github.com/pao-1024/pao/pull/36)（`9966479`）中 [Controller.tsx](../hardware/sections/Controller.tsx) 新增 GPIO8 / GPIO9 接线的真实差异，结合 Hardware 的连通性与图纸一致性检查。临时生成工程需整理后入库，CI 检查与实际 SIL、Blender 仿真和实机验收分别说明，范围见[大纲](../docs/final-presentation-outline.md)。

第 6 页放大原始 [PAO 模块接线原理图（参考）](../hardware/schematic.svg)的 OLED 区域并说明代码生成；第 7 页展示 tscircuit 生成的全图、局部放大与[连通性测试](../hardware/test/connectivity.test.ts)中的真实断言，提供原图链接。机械结构页保持流程示意，涵盖外壳、底盘、支架与装配，说明当前 Blender 研发中的 Agent 建模与刚体仿真评估。

电路、固件编写与运行章节分别突出 **tscircuit、ESP-IDF、esp32sim**。第 8 页复用[业务生成与自动构建实际界面](../experimental/platform/agent-preview.jpg)，标注已有实验原型；第 9 页复用 [PAO 参考模拟器实际界面](../simulator/images/simulator-overview.png)，结合芯片透明性说明和行为验收标准展示运行路径。

代码让 Agent 能动手，评估函数让 Agent 知道是否做对，模拟器让评估可自动执行。演示稿先讲 PAO 验证的工程路径与实机行为，再进入未来展望：PAO Studio 将已有实验机制发展为可复用工作台。Studio 页面展示本地实验原型，表达产品化方向。

在 Studio 展望之后，结尾展望将整套开发流程封装为可复用的 Skill。机械建模与刚体仿真作为当前研发单独讲述，不作为未来规划或实机验收结论。能力状态与推进目标见[平台规划](../docs/platform-roadmap.md)。正文、排版和讲者备注分别维护在 `slides.md`、`style.css` 和 Markdown 注释里。

实车照片复用仓库的 `assets` release，模拟器与 Studio 截图复用仓库素材。`prepare-assets.sh` 将下载素材缓存到本 worktree 的 `tmp/presentation-assets/`，再准备本目录的 `public/` 资源；原理图直接复制仓库的 `hardware/schematic.svg`，不重绘或重复提交。该图展示模块接线，不代表 PCB 或实物验收通过。

需要 Node.js 22.12+、pnpm 和已登录并可读取本仓库 release 的 GitHub CLI。在本目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 <http://localhost:4174/>。方向键或空格翻页，Slidev 的讲者模式可查看每页备注；`pnpm build` 生成可托管的静态演示稿到 `dist/`。需要 PDF 时运行 `pnpm export`，首次使用需按 Slidev 的[导出说明](https://sli.dev/guide/exporting)准备浏览器依赖。

实车与模拟器视频使用 GitHub 附件，仓库页面及相关素材需要有访问权限的 GitHub 登录会话，现场演示前确认可播放。内容与验证边界见[大纲](../docs/final-presentation-outline.md)。

主稿使用三张 Mermaid 流程图：[pr-review.mmd](pr-review.mmd) 表达工程变更、工具检查与人工审查，[agent-loop.mmd](agent-loop.mmd) 表达 Agent 生成、评估与错误反馈闭环，[mechanical-loop.mmd](mechanical-loop.mmd) 表达 Agent 驱动 Blender 建模与刚体仿真评估的工作流。[architecture.mmd](architecture.mmd) 保留为补充资源，表达正式固件在芯片与外设模型中运行并输出证据的路径。各图的 SVG 位于 `public/`，更新源码后用 Mermaid CLI 重新生成：

```sh
mmdc -i pr-review.mmd -o public/pr-review.svg -c mermaid-config.json -b transparent
mmdc -i agent-loop.mmd -o public/agent-loop.svg -c mermaid-config.json -b transparent
mmdc -i architecture.mmd -o public/architecture.svg -c mermaid-config.json -b transparent
mmdc -i mechanical-loop.mmd -o public/mechanical-loop.svg -c mermaid-config.json -b transparent
```
