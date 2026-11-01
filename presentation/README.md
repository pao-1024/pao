# PAO 决赛演示稿

基于 [Slidev](https://sli.dev/guide/) 的十六页演示稿。`slides.md` 是全局配置和页面目录，每页的正文和讲者备注在 `pages/`，排版在 `style.css`。

需要 Node.js 22.12+、pnpm、ffmpeg，以及已登录的 GitHub CLI。在仓库根目录运行：

```sh
task presentation:dev
```

会安装依赖、准备素材，并在浏览器打开 <http://localhost:4174/>。`task presentation:build` 生成静态站点到 `presentation/dist/`；导出 PDF 时在本目录运行 `pnpm export`。

`prepare-assets.sh` 会在启动前准备素材：用项目依赖 mermaid-cli 把 `diagrams/` 下的 Mermaid 图生成为 SVG，从仓库复制图片，并按 [docs/making-of.md](../docs/making-of.md) 的链接下载五段视频。生成的素材不提交到 Git。演示前在实际设备上确认视频播放和声音。
