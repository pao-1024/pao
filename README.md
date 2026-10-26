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

PAO 是一款语音交互小车，也是 PAO Studio 硬件开发平台的首个验证产品。我们用 PAO 验证从需求、模块组合、接线与电路检查，到固件编译、仿真和实物运行的开发流程，让同一套工具能够用于更多智能硬件项目。

## 硬件即代码 · Hardware as Code

**接线可以 diff，电路可以测试，原理图可以构建。**

PAO 用 [tscircuit](https://tscircuit.com/) 把供电、主控、音频、屏幕和电机驱动写成可组合的 TSX 组件。模块能复用，连线能在 PR 中审查，图纸从源码生成；CI 自动检查 GPIO、电源、输出连接和图纸一致性，让硬件设计也进入 Git、PR 和 CI 的协作流程。

PAO 参考机的模块接线与原理图见 [ESP32-S3 模块接线图与预览说明](hardware/README.md)。

## 没有硬件，也能开始设计与验证

PAO Studio 是 Agent 驱动的模块化硬件开发平台。把有真实引脚、驱动和仿真模型的硬件像软件模块一样组合，让 Agent 根据自然语言需求选择模块、自动接线、生成 PCB 与业务固件，并根据检查、编译和仿真中的报错迭代修复。

在实物模块到手之前，可以先检查供电、公共地、复位、负载、引脚和总线地址，并运行编译后的固件；在打板之前，可以检查模块封装、布局、铜线连接和制造规则。已建模范围内的问题可以在软件工作台里复现、观察和修改，减少等待实物与提前可发现的打板返工。

目前实验性工作台已支持内置真实模块的组合、自动接线、原理图与 PCB 制造文件生成、固件编译，以及软件在环（Software-in-the-Loop，SIL）场景验收。当前 PCB 输出是指定模块的安装板；仿真覆盖已建模的数字接口与业务行为，温升、射频、声学、机械负载和实际测量精度仍需实物验证。使用方法和能力范围见 [PAO Studio](experimental/platform/README.md)。

## 未来方向与商业化规划

我们希望把 PAO 验证过的开发流程推广到更多智能硬件项目，服务独立开发者和小型硬件团队。平台的商业价值是帮助团队在采购、组装和打板前发现问题，并复用已经验证的模块、驱动与工程方案。

- 产品规划：扩展真实模块与驱动，建立可复用的设备方案和批量 SIL 回归，让更多项目能在没有实物时开始开发。
- 验证规划：把软件检查与硬件在环（Hardware-in-the-Loop，HIL）、样板装配和实物测量结合，核对模型与真实设备的差异。
- 商业化探索：验证团队协作、托管编译与仿真、私有模块库及工程交付支持的付费需求；这些属于后续方向，当前仍是本地实验性工作台。

产品阶段、商业化假设与验证方式见[硬件开发平台规划](docs/platform-roadmap.md)。

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
