# PAO 决赛演示稿

这版 [Slidev](https://sli.dev/guide/) 演示稿按[10 分钟答辩大纲](../docs/final-presentation-outline.md)编排为十页。演示稿的正文、排版和讲者备注分别维护在 `slides.md`、`style.css` 和 Markdown 注释里；第八页展示电路、固件、模拟器、Studio 与演示稿自身的源码入口。实车照片从仓库已有的 `assets` release 获取，模拟器与 Studio 截图复用仓库素材；媒体文件只缓存到本目录的 `public/`，不重复提交。

需要 Node.js 22.12+、pnpm 和已登录并可读取本仓库 release 的 GitHub CLI。在本目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 <http://localhost:4174/>。方向键或空格翻页，Slidev 的讲者模式可查看每页备注；`pnpm build` 生成可托管的静态演示稿到 `dist/`。需要 PDF 时可使用 Slidev 的[导出功能](https://sli.dev/guide/exporting)。

实车与模拟器视频为 GitHub 附件链接，现场演示前确认网络可访问。内容与验证边界见[大纲](../docs/final-presentation-outline.md)。

架构图的 Mermaid 源码为 [architecture.mmd](architecture.mmd)，演示稿使用从该源码生成的 `public/architecture.svg`，确保离线放映时能稳定显示。更新源码后用 Mermaid CLI 重新生成 SVG：

```sh
mmdc -i architecture.mmd -o public/architecture.svg -c mermaid-config.json -b transparent
```
