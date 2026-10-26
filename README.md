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

## 实车演示

[![PAO 实车演示](https://github.com/pao-1024/pao/releases/download/assets/photo-12-first-rollout.jpg)](docs/making-of.md#演示视频)

观看[实车演示视频](docs/making-of.md#演示视频)，包含语音控制、遥控控制和发射测试。完整装配记录见[PAO 制作过程](docs/making-of.md)。

## 系统组成

设备有两条并列控制入口：灵矽服务通过 MCP 调用设备工具，局域网遥控页通过 WebSocket 下发 JSON。两条路径最终汇合到 `PaoBoard`，再进入底盘、测距、发射和外设模块。

```mermaid
flowchart TD
    subgraph McpPath["MCP 控制"]
        direction LR
        Voice["用户语音"] --> Linxi["灵矽服务"] --> Mcp["MCP 工具调用"]
    end

    subgraph WebSocketPath["WebSocket 控制"]
        direction LR
        Web["局域网遥控页"] --> WebSocket["WebSocket /ws"]
    end

    Mcp --> Board
    WebSocket --> Board

    subgraph Firmware["ESP32-S3 PAO 固件"]
        Board["PaoBoard 适配层<br/>参数校验 · 运动状态 · NVS · HTTP"]
        Board --> Chassis["Chassis"]
        Chassis --> Motors["Motor × 2"]
        Motors --> Driver["MX1508"]
        Driver --> Wheels["左右电机"]

        Board --> Distance["ForwardDistanceMover"]
        Distance --> Sensor["HcSr04"]
        Sensor --> Ultrasonic["HC-SR04"]

        Board --> Launcher["Launcher"]
        Launcher --> Relay["继电器"]
        Relay --> Gun["电磁发射器按钮"]

        Board --> Peripherals["OLED · I2S 麦克风与功放 · 状态灯"]
    end

    Firmware -.->|"烧录并运行"| Hardware["实机<br/>真实外设与 Wi-Fi"]
    Firmware -.->|"正式镜像启动"| Simulator["模拟器<br/>ROM + Flash + 外设模型 + 浏览器音频"]
```

## 团队与分工

### Zhiqiang Zhang（[@zhangzqs](https://github.com/zhangzqs)）

- 硬件设计：使用 tscircuit 定义电池保护、电源开关、5V 升压、ESP32-S3、麦克风、功放、OLED、HC-SR04、MX1508、发射继电器和发射器接线；统一 44 针开发板引脚、共享网络与电源域，生成原理图并补齐连通性测试。
- 电机与底盘：实现 MX1508 双路电机驱动、左右轮方向适配、前进／后退／原地旋转／立即停止，以及平移和旋转最大输出、左右轮比例和 NVS 持久化；接入网页、WebSocket 和语音底盘控制。
- 电磁发射：完成 HU-064 发射器选型和组装，设计常供电、独立 3.3V 与低电平继电器接线；实现单次 300 ms 发射脉冲，以及上电保持断开和并发调用串行化。
- 距离控制：接入 3.3V 版 HC-SR04，实现 RMT 微秒级回波捕获、60 ms 触发间隔和测距错误处理；实现按前方距离变化前进、10 cm 停止余量、15 秒超时和新指令取消。
- 板级集成：接入 SSD1306 OLED，建立 PAO 板型、GPIO 配置、MCP 工具、遥控页和 WebSocket 控制服务，使网页、语音和驱动共享同一套板级状态与参数校验。
- 工程保障：维护 EIM 构建入口、ccache、固件 CI 和产物上传，补充硬件接线测试与仓库配置检查，保证硬件设计、固件编译和文档能够持续验证。

### jimyag（[@jimyag](https://github.com/jimyag)）

- 工程基础：建立固件目录、小智外部组件接入、Task 构建入口和最小语音板型，把上游源码、构建缓存与仓库业务代码分开管理。
- 模拟器内核：接入固定版本的 esp32sim，从 ROM 启动正式 PAO 固件，模拟 Flash、NVS、Wi-Fi、I2S、RMT、SSD1306 和 GPIO48 状态灯。
- 观测系统：采集固件真实 GPIO、I2C、MCPWM 和 I2S 活动，解析底盘位姿、前方距离、总线事件和 UART0 日志，并通过 WebSocket 推送到浏览器。
- 模拟交互：实现 React/Three.js/Canvas 和 AudioWorklet 页面，显示 OLED、可跟随的 3D 小车、场地轨迹、引脚连线、音频波形和串口日志，支持浏览器麦克风和扬声器。
- 语音与遥控：接入底盘、电磁发射、网络地址和待机 MCP 工具；实现局域网遥控页、方向续发、输出与轮速校准、距离查询、断线停车和新指令替换旧运动。
- 联调验收：打通测距回波、按距离前进、发射音效和 3D 场景，编写底盘三阶段验收脚本，并记录固件、模拟器和实机交互的验证结果。

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

PAO 参考机的模块接线与原理图见 [ESP32-S3 模块接线图与预览说明](hardware/README.md)。

## 固件 · Voice & Motion

**一句话，变成一条设备指令。**

固件基于 ESP-IDF 和小智语音工程，在 ESP32-S3 上完成唤醒词、音频、显示与设备控制。灵矽通过 MCP 调用底盘、测距、电磁发射、网络信息和待机工具；局域网遥控页通过 WebSocket 进入同一套板级控制逻辑。运动参数保存在 NVS，底盘定时停车、测距失败停车和发射继电器脉冲都由设备侧校验与执行。

当前语音角色使用灵矽 AI 智控台，音色、完整提示词和应用步骤见[PAO 语音助手配置](docs/agent.md)。

GPIO、板型、语音工具、局域网遥控、构建方式和实机接入说明见[固件说明](firmware/README.md)。

## 模拟器 · Firmware in the Loop

**同一份正式固件，在浏览器里运行。**

模拟器使用 Rust、esp32sim 和仓库中的 PAO 板型，从芯片 ROM 启动正式固件。页面将固件真实 I2C 写入渲染成 OLED，把 MCPWM 转为可跟随的 3D 小车，把 HC-SR04 回波送进正式 RMT 驱动，并同步显示接线状态、I2C、PWM、I2S、UART 和底盘指令。浏览器麦克风与扬声器可直接进入设备的语音交互链路。

[观看模拟器使用演示](https://github.com/user-attachments/assets/b82adcdc-420b-4e07-abb6-0e4ae3ad228b)：在浏览器里通过语音控制正式固件，并查看 OLED、3D 小车、I2C、PWM、I2S 和日志。视频中的回声来自录制时的音频回采，不代表模拟器中的语音效果。

启动、配网、语音验证、底盘验收和模拟器架构见[模拟器说明](simulator/README.md)。

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

## 没有硬件，也能开始设计与验证

PAO 是一款语音交互小车，也是 PAO Studio 硬件开发平台的首个验证产品。我们用 PAO 验证从需求、模块组合、接线与电路检查，到固件编译、仿真和实物运行的开发流程，让同一套工具能够用于更多智能硬件项目。

PAO Studio 是 Agent 驱动的模块化硬件开发平台。把有真实引脚、驱动和仿真模型的硬件像软件模块一样组合，让 Agent 根据自然语言需求选择模块、自动接线、生成 PCB 与业务固件，并根据检查、编译和仿真中的报错迭代修复。

在实物模块到手之前，可以先检查供电、公共地、复位、负载、引脚和总线地址，并运行编译后的固件；在打板之前，可以检查模块封装、布局、铜线连接和制造规则。已建模范围内的问题可以在软件工作台里复现、观察和修改，减少等待实物与提前可发现的打板返工。

目前实验性工作台已支持内置真实模块的组合、自动接线、原理图与 PCB 制造文件生成、固件编译，以及软件在环（Software-in-the-Loop，SIL）场景验收。当前 PCB 输出是指定模块的安装板；仿真覆盖已建模的数字接口与业务行为，温升、射频、声学、机械负载和实际测量精度仍需实物验证。使用方法和能力范围见 [PAO Studio](experimental/platform/README.md)。

## 未来方向与商业化规划

我们希望把 PAO 验证过的开发流程推广到更多智能硬件项目，服务独立开发者和小型硬件团队。平台的商业价值是帮助团队在采购、组装和打板前发现问题，并复用已经验证的模块、驱动与工程方案。

- 产品规划：扩展真实模块与驱动，建立可复用的设备方案和批量 SIL 回归，让更多项目能在没有实物时开始开发。
- 验证规划：把软件检查与硬件在环（Hardware-in-the-Loop，HIL）、样板装配和实物测量结合，核对模型与真实设备的差异。
- 商业化探索：验证团队协作、托管编译与仿真、私有模块库及工程交付支持的付费需求；这些属于后续方向，当前仍是本地实验性工作台。

产品阶段、商业化假设与验证方式见[硬件开发平台规划](docs/platform-roadmap.md)。

---

<div align="center">
<sub>Talk is cheap. We shoot anyway.</sub>
</div>
