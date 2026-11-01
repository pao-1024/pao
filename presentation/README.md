# PAO 决赛演示稿

这份 [Slidev](https://sli.dev/guide/) 演示稿以 **AI Agent 全自动硬件开发、万物皆代码、评估函数与透明芯片级仿真** 为主线，按[10 分钟答辩大纲](../docs/final-presentation-outline.md)编排为十页：代码让 Agent 能动手，评估函数让 Agent 知道是否做对，模拟器让评估可自动执行。正文、排版和讲者备注分别维护在 `slides.md`、`style.css` 和 Markdown 注释里。PAO Studio 展示支持模块范围内由评估结果驱动的自动修复闭环，PAO 实车用于说明固件、外设与实际行为的对应关系。

实车照片复用仓库的 `assets` release，模拟器与 Studio 截图复用仓库素材。`prepare-assets.sh` 将下载素材缓存到本 worktree 的 `tmp/presentation-assets/`，再准备本目录的 `public/` 资源，不重复提交媒体文件。

需要 Node.js 22.12+、pnpm 和已登录并可读取本仓库 release 的 GitHub CLI。在本目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 <http://localhost:4174/>。方向键或空格翻页，Slidev 的讲者模式可查看每页备注；`pnpm build` 生成可托管的静态演示稿到 `dist/`。需要 PDF 时运行 `pnpm export`，首次使用需按 Slidev 的[导出说明](https://sli.dev/guide/exporting)准备浏览器依赖。

实车与模拟器视频使用 GitHub 附件，仓库页面及相关素材需要有访问权限的 GitHub 登录会话，现场演示前确认可播放。内容与验证边界见[大纲](../docs/final-presentation-outline.md)。

两张工程图由 Mermaid 源码维护：[agent-loop.mmd](agent-loop.mmd) 表达 Agent 生成、评估与错误反馈闭环，[architecture.mmd](architecture.mmd) 表达正式固件与实物芯片、芯片仿真的关系。演示稿使用对应的 `public/*.svg`，更新源码后用 Mermaid CLI 重新生成：

```sh
mmdc -i agent-loop.mmd -o public/agent-loop.svg -c mermaid-config.json -b transparent
mmdc -i architecture.mmd -o public/architecture.svg -c mermaid-config.json -b transparent
```
