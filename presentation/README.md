# PAO 决赛演示稿

基于 [Slidev](https://sli.dev/guide/) 的十八页演示稿。`slides.md` 是全局配置和页面目录，每页的正文和讲者备注在 `pages/`，排版在 `style.css`。

需要 Node.js 22.12+、pnpm、ffmpeg、uv、Task，以及已登录的 GitHub CLI。在仓库根目录运行：

```sh
task presentation:dev
```

会安装依赖、准备素材，并在浏览器打开 <http://localhost:4174/>。`task presentation:build` 生成静态站点到 `presentation/dist/`；导出 PDF 时在本目录运行 `pnpm export`。

`prepare-assets.sh` 会在启动前准备素材：用项目依赖 mermaid-cli 把 `diagrams/` 下的 Mermaid 图生成为 SVG，从仓库复制图片，并按 [docs/making-of.md](../docs/making-of.md) 的链接下载五段视频。机械部分复用 CadQuery 装配预览，并运行 `task mechanical:animate` 生成三球仿真视频；首次运行会通过 uv 安装机械依赖，后续在模型、仿真源码或依赖变更时重新生成。生成的素材不提交到 Git。演示前在实际设备上确认视频播放和声音。

机械部分在第 10–12 页，分别展示机构设计、三球刚体仿真与打印交付。第 12 页在 `pages/10-mechanical-print.md` 预留实物照片位置；打印后用实际照片替换占位区域并更新图注，照片复用素材 release，下载入口维护在 `prepare-assets.sh`。建模与仿真结果不代表实物验收。
