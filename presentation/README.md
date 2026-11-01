# PAO 决赛演示稿

这份 [Slidev](https://sli.dev/guide/) 演示稿以 **探索 Agent 时代的硬件开发新范式** 为主题，按[10 分钟答辩大纲](../docs/final-presentation-outline.md)编排为十一页，统一使用白底。先总览电路设计、固件编写、固件运行和机械结构，再用 Agent 闭环解释评估函数的作用，随后逐项展开执行方式与评估依据。第 5 页展示由 TSX / tscircuit 生成的 [PAO 模块接线原理图（参考）](../hardware/schematic.svg)，提供全图、局部放大及原图链接，并关联[连通性测试](../hardware/test/connectivity.test.ts)。固件运行页说明透明芯片级仿真；机械结构页涵盖外壳、底盘、支架与装配，说明当前 Blender 研发中的 Agent 建模、几何 / 装配检查和刚体动力学评估。

电路、固件编写与运行章节分别突出 **tscircuit、ESP-IDF、esp32sim**。第 6 页复用[业务生成与自动构建实际界面](../experimental/platform/agent-preview.jpg)，标注已有实验原型；第 7 页复用 [PAO 参考模拟器实际界面](../simulator/images/simulator-overview.png)，结合芯片透明性说明和行为验收标准展示运行路径。

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

主稿使用两张 Mermaid 流程图：[agent-loop.mmd](agent-loop.mmd) 表达 Agent 生成、评估与错误反馈闭环，[mechanical-loop.mmd](mechanical-loop.mmd) 表达 Agent 驱动 Blender 建模与刚体仿真评估的工作流。[architecture.mmd](architecture.mmd) 保留为补充资源，表达正式固件在芯片与外设模型中运行并输出证据的路径。各图的 SVG 位于 `public/`，更新源码后用 Mermaid CLI 重新生成：

```sh
mmdc -i agent-loop.mmd -o public/agent-loop.svg -c mermaid-config.json -b transparent
mmdc -i architecture.mmd -o public/architecture.svg -c mermaid-config.json -b transparent
mmdc -i mechanical-loop.mmd -o public/mechanical-loop.svg -c mermaid-config.json -b transparent
```
