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

## 功能

- **语音控制**：唤醒词“小炮小炮”；可查询前方距离、前进指定厘米数、前后移动、原地转向、停车、开炮、查询设备 IP 和结束对话。
- **双模式遥控**：联网后打开设备 IP 对应页面，可用方向按钮或 WASD 驾驶；支持输出上限、左右轮比例、实时测距和开炮。
- **安全停车**：方向指令带有效期，网页失焦、关闭或断网后不续发；支持立即停止和按距离运动的超时、测距失败停车。
- **状态显示**：SSD1306 OLED 显示设备状态、表情、对话与访问地址；开发板状态灯和扬声器同步反馈。
- **电磁发射**：语音或网页单次触发；继电器按下发射器按钮，同时播放发射音效。
- **硬件即代码**：用 tscircuit 的 TSX 描述供电、ESP32-S3、麦克风、功放、OLED、超声波、电机驱动和发射器接线，并从源码生成原理图。
- **芯片级模拟**：从 ROM 启动正式固件，显示 OLED、引脚状态、I2C、MCPWM、I2S、串口和可跟随的 3D 小车；支持浏览器麦克风和扬声器。

## 硬件即代码 · Hardware as Code

**接线可以 diff，电路可以测试，原理图可以构建。**

PAO 用 [tscircuit](https://tscircuit.com/) 把供电、主控、音频、屏幕和电机驱动写成可组合的 TSX 组件。模块能复用，连线能在 PR 中审查，图纸从源码生成；CI 自动检查 GPIO、电源、输出连接和图纸一致性，让硬件设计也进入 Git、PR 和 CI 的协作流程。

当前覆盖模块接线与原理图，详见 [ESP32-S3 模块接线图与预览说明](hardware/README.md)。

## 固件 · Voice & Motion

**一句话，变成一条设备指令。**

固件基于 ESP-IDF 和小智语音工程，在 ESP32-S3 上完成唤醒词、音频、显示与设备控制。灵矽通过 MCP 调用底盘、测距、电磁发射、网络信息和待机工具；局域网遥控页通过 WebSocket 进入同一套板级控制逻辑。运动参数保存在 NVS，底盘定时停车、测距失败停车和发射继电器脉冲都由设备侧校验与执行。

GPIO、板型、语音工具、局域网遥控、构建方式和实机接入说明见[固件说明](firmware/README.md)。

## 模拟器 · Firmware in the Loop

**同一份正式固件，在浏览器里运行。**

模拟器使用 Rust、esp32sim 和仓库中的 PAO 板型，从芯片 ROM 启动正式固件。页面将固件真实 I2C 写入渲染成 OLED，把 MCPWM 转为可跟随的 3D 小车，把 HC-SR04 回波送进正式 RMT 驱动，并同步显示接线状态、I2C、PWM、I2S、UART 和底盘指令。浏览器麦克风与扬声器可直接进入设备的语音交互链路。

启动、配网、语音验证、底盘验收和模拟器架构见[模拟器说明](simulator/README.md)。

## 开发

固件代码和构建入口统一放在 `firmware/`。在根目录运行 `task firmware:build`，
或进入 `firmware/` 后运行 `task build`。请先通过 EIM 安装并选择 ESP-IDF；
构建时会自动准备小智源码。环境安装、上游版本选择、GPIO 和 IDE 配置见[固件说明](firmware/README.md)。

模拟器代码、板型模型、网页和 Taskfile 独立放在 `simulator/`。
在根目录使用 `task simulator:install`、`task simulator:run` 和 `task simulator:check`，
完整配网与语音验证方法见[模拟器说明](simulator/README.md)。

系统组成、模块接口、数据流、团队分工和验证边界见[架构设计](docs/architecture.md)。

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
