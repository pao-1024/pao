# PAO 决赛演示稿

基于 [Slidev](https://sli.dev/guide/) 的十八页演示稿。`slides.md` 是全局配置和页面目录，每页的正文和讲者备注在 `pages/`，排版在 `style.css`。

[在线浏览演示稿](https://pao-1024.github.io/pao/)；`main` 更新后由 GitHub Actions 构建并发布到 Pages。

演示页面自动开始 10 分钟倒计时，右上角可暂停、继续或重置；导出时隐藏倒计时控件。演示视频默认以 2 倍速播放。

需要 Node.js 22.12+、pnpm、ffmpeg、uv、Task，以及已登录的 GitHub CLI。在仓库根目录运行：

```sh
task presentation:dev
```

会安装依赖、准备素材，并在浏览器打开 <http://localhost:4174/>。`task presentation:build` 生成静态站点到 `presentation/dist/`；`task presentation:pptx` 导出 PowerPoint 到 `presentation/slides.pptx`。导出 PDF 时在本目录运行 `pnpm export`。

`prepare-assets.sh` 会在启动前准备素材：用项目依赖 mermaid-cli 把 `diagrams/` 下的 Mermaid 图生成为 SVG，从仓库复制图片，并按 [docs/making-of.md](../docs/making-of.md) 的链接下载五段视频。机械部分复制 CadQuery 装配预览，并用 `task mechanical:animate` 生成三球仿真视频，机械源码或依赖变更后重新生成。生成的素材不提交到 Git。演示前在实际设备上确认视频播放和声音。

第 12 页（`pages/10-mechanical-print.md`）使用 [机械机构实物展示视频](https://github.com/pao-1024/pao/issues/55#issuecomment-6597724232)，由 `prepare-assets.sh` 下载并转成浏览器可播放的格式。视频展示打印件与接线，电机负载和实物连发仍需单独验收。

## AI Native 工作流演示稿

`workflow.md` 是独立的十三页简洁演示稿，围绕“硬件 = 电路 × 软件 × 机械设计”，类比 XGo 的生态组合，介绍 PAO 的 AI Native 开发流程。引用出处在对应页面，补充说明在讲者备注。

复用本目录依赖与样式，无需准备原演示稿的图片和视频。在仓库根目录执行 `task presentation:setup` 后，在本目录运行：

```sh
pnpm exec slidev workflow.md --port 4175
pnpm exec slidev build workflow.md --out ../tmp/workflow-dist
pnpm exec slidev export workflow.md --format pptx --output ../tmp/workflow.pptx
```

导出时将 `PLAYWRIGHT_BROWSERS_PATH` 指向本 worktree 的 `tmp/playwright-browsers`，并用 `pnpm exec playwright install chromium` 准备浏览器。PowerPoint 导出为逐页图像，修改内容后需从 Markdown 重新导出。
