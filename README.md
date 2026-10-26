<div align="center">

<img src="docs/icon.svg" width="112" alt="PAO" />

# PAO

**PAO Aims Ordnance**

一台听得懂人话、会开火的小车

<sub>2026 1024 Hackathon · 智能硬件赛道</sub>

</div>

---

> ### PAO = PAO Aims Ordnance
>
> 这是一个**递归缩写**（recursive acronym）：全称的第一个词，就是缩写本身。
> 和 `GNU's Not Unix`、`YAML Ain't Markup Language`、`WINE Is Not an Emulator` 一样，
> 它的定义永远指回自己。说不清，也都说得清。

## 它是什么

不需要摇杆，不需要 App，不需要记指令表。**说出口，就打出去。**

## 硬件即代码 · Hardware as Code

**接线可以 diff，电路可以测试，原理图可以构建。**

PAO 用 [tscircuit](https://tscircuit.com/) 把供电、主控、音频、屏幕和电机驱动写成可组合的 TSX 组件。模块能复用，连线能在 PR 中审查，图纸从源码生成；CI 自动检查 GPIO、电源、输出连接和图纸一致性，让硬件设计也进入 Git、PR 和 CI 的协作流程。

当前覆盖模块接线与原理图，详见 [ESP32-S3 模块接线图与预览说明](hardware/README.md)。

## 开发

实验性 React 硬件工作台在 `experimental/platform/`，运行 `task platform:dev` 后访问
<http://127.0.0.1:4173/>。支持真实模块自动接线、tscircuit 原理图、PCB 制造文件、
业务固件生成与编译仿真，能力边界和使用方法见 [PAO Studio](experimental/platform/README.md)。

固件代码和构建入口统一放在 `firmware/`。在根目录运行 `task firmware:build`，
或进入 `firmware/` 后运行 `task build`。请先通过 EIM 安装并选择 ESP-IDF；
构建时会自动准备小智源码。环境安装、上游版本选择、GPIO 和 IDE 配置见[固件说明](firmware/README.md)。

模拟器代码、板型模型、网页和 Taskfile 独立放在 `simulator/`。
在根目录使用 `task simulator:install`、`task simulator:run` 和 `task simulator:check`，
完整配网与语音验证方法见[模拟器说明](simulator/README.md)。

## 项目 Skill

先安装 [Task v3](https://taskfile.dev/installation/)、Git 和 Node.js 22.20.0 或更新版本（含 npm/npx），然后在仓库目录执行：

```sh
task skills:install
```

该命令会按照 `skills-lock.json` 一次性安装全部项目 skill，目前包含用于电路和 PCB 设计的 `tscircuit`。清单通过上游 commit 固定版本，完整文件安装到 `.agents/skills/`，该目录不纳入 Git。

新增或更新 skill 后，提交更新的 `skills-lock.json` 即可。任务固定使用 `skills@1.7.4` 的 `experimental_install` 命令恢复清单。

---

<div align="center">
<sub>Talk is cheap. We shoot anyway.</sub>
</div>
