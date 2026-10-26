# PAO 模拟器

仿真通过本仓库的 `pao-sim` Rust 扩展，调用固定版本的
[esp32sim 内核](https://github.com/pao-1024/esp32sim)，
从芯片 ROM 启动 `task firmware:build` 生成的正式 PAO 镜像。
板型、I2S Codec、唤醒词识别、Opus 和灵矽协议均复用仓库固件。
`pao` 模拟板将 GPIO41/42 上 SSD1306 的真实 I2C 写入渲染为图像，并显示 GPIO48 状态灯。
网页使用电脑麦克风和扬声器与设备语音交互。

板型与 SSD1306 模型在 `pao-sim/src/`，React 网页与 AudioWorklet 在 `web/`。
内核 fork 只维护通用 CPU、网络、Flash、I2S 支持和库入口，不包含 PAO 板型或页面。
启动器复用内核 CLI 的初始化、固件加载、网络、重启及 Flash 保存逻辑，通过公开
`BoardModel` 接口挂载本地板型；不依赖动态插件 ABI。

`simulator/esp32sim/` 是 [pao-1024/esp32sim](https://github.com/pao-1024/esp32sim)
的 Git submodule，跟踪组织维护的 `pao` 分支，由父仓库的 gitlink 固定具体 commit。
内核改动经 PR 合入 `pao`，`main` 保持上游基线；本地 crate 直接依赖子模块源码。
`Cargo.lock` 固定 crate 依赖关系。
构建产物为 `tmp/esp32sim-build/release/pao-sim`，React 网页构建到 `tmp/simulator-web/`。

首次检出可运行 `git submodule update --init --recursive`；`task simulator:install` 也会初始化子模块。
安装始终使用父仓库记录的 commit，不会自动追随远端分支。内核升级时通过 PAO 的 PR
更新 gitlink；若子模块有本地改动，安装会停止而不覆盖。

## 启动

需要 Git、Python 3.10+、Task、Node.js 24+、pnpm 10.32.1 和稳定版 Rust 工具链。
ESP-IDF 使用主固件相同的 EIM 入口；先安装并选择 SDK，或激活已有 SDK 环境。
首次需要联网下载源码、组件及模拟器依赖，后续复用缓存。

在仓库根目录先构建正式固件，再一条命令构建模拟器、React 网页并启动：

```sh
task firmware:build
task simulator:run
```

已有固件、模拟器和网页构建时，可直接运行 `python3 simulator/run-esp32sim.py` 重新启动。

启动器从已激活 ESP-IDF 环境的 `ESP_ROM_ELF_DIR` 自动定位 `esp32s3_rev0_rom.elf`；
未激活时，通过 `eim run` 读取当前选中环境的 ROM 目录。
需要使用其他 ROM 时，可运行 `task simulator:run -- --rom '<ROM ELF 的绝对路径>'`。
首次启动自动生成本地单播 MAC 和 UUID，保存到 `tmp/esp32sim-full-flow/identity.json`，
后续每次启动复用同一身份，无需手动传入设备参数。
`interactive.bin` 的 NVS 预置该 UUID 和虚拟 AP `pao-sim-ap` 的凭据，
固件开机直接联网，首次联网时按服务返回的激活提示完成绑定。不要提交设备身份或服务配置。

身份文件损坏，或已有 Flash 却缺少身份文件时，启动器会报错，不覆盖原有设备状态。
需要新建虚拟设备时，将 `tmp/esp32sim-full-flow/` 整个目录移到别处备份后再启动。

打开 <http://127.0.0.1:8080/>，点击“启用麦克风和扬声器”并允许麦克风权限，
说“小炮小炮”后直接提问。网页包含以下内容：

- 设备：OLED、状态灯、小车 3D 视图，以及固件日志中最近的底盘指令。
  3D 场地为封闭的 6×4m 矩形，网格间隔 10cm，提供“全场”和“跟车”视角。
  位姿按模拟器时间和两轮占空比计算，页面显示同一份后端位姿，关闭网页不影响运动或测距。
  车体以半径 12cm 的圆形约束在边界内；速度按占空比线性换算，满速为 30cm/s、轮距为 15.6cm，
  是功能仿真的假设值，不代表实车校准结果。
  发射器常供电，仿真电量按固定时间线性累积，继电器吸合时射出炮弹并清零；
  充满时间只是仿真参数，不代表实物。实测后可修改 `web/protocol.ts` 的 `FULL_CHARGE_S`。
- 接线与信号：ESP32-S3 到各模块的引脚连线，有通信的连线会高亮，并标出电平、占空比、采样率或流量。
- 总线通信：SSD1306 的 I2C 事务（解码后的命令和原始字节）、MX1508 的 MCPWM 占空比变化、
  GPIO 电平变化，以及两路 I2S 音频的统计，可按总线过滤或暂停。
- I2S 波形与 UART0 日志：日志支持关键字过滤，并从中解析设备状态。

顶栏“遥控”打开固件内置的遥控页 <http://127.0.0.1:8081/>，由启动器把本机 8081 端口转发到设备的 80 端口。

3D 场景通过 `ws://127.0.0.1:8081/ws` 连接正式固件的遥控服务。
“前进”输入框调用 `/api/move_forward` 发出厘米指令，“停止”调用 `/api/chassis` 的 `emergency_stop` 动作，
“测距 / 进度”调用 `/api/distance`，显示固件实际测距值及完成状态。
连接断开或请求超时会显示错误，下次操作重新连接，不自动重发运动指令。
场景中的前方距离和蓝色射线由车头到矩形边界的射线交点计算；传感器位于车体中心前方 10.5cm。
PAO 板型在 GPIO8 检测到至少 10µs 的 Trig 脉冲后，向 GPIO9 发送高电平 Echo，
脉宽为厘米数 × 58µs，经内核 RMT RX 和正式 HC-SR04 驱动返回固件，不直接注入驱动返回值。
超出 2–400cm 量程时不产生回波，固件报告测距失败。仿真只包含矩形四壁，不模拟路锥、噪声、多径或材质差异。
按厘米运动的参数、15 秒超时和 10cm 停车余量见[板型说明](../firmware/boards/pao/README.md)。

引脚数据由 `pao-sim/src/trace.rs` 采集：GPIO 和 I2C 来自板型回调，电机 PWM 由 MMIO 观察者
解码 MCPWM0 寄存器写入得到，每 50 ms 仿真时间通过同一个 WebSocket 推送一次。
建议戴耳机避免扬声器声音再次进入麦克风。麦克风和扬声器开启后保持打开，模拟器重启或断线重连后继续收音，
点击按钮或关闭页面才会关闭。说话时唤醒词识别会让仿真慢于实时，回复比实机慢；
启动器传入 `--max-lag 4`，仿真在静音时追回落后。实时麦克风按原顺序排队，保留全部采样，
不通过丢弃旧音频追赶实时；持续低于实时速度时，队列占用和交互延迟仍会增长。
WebSocket 的音频输入和输出同样保序排队，页面长时间不读取时会增加内存占用。
3D 场景下方可打开固件遥控页，使用方向按钮并调整输出渐变、最小有效输出和左右轮比例，
具体步骤见[板型说明](../firmware/boards/pao/README.md#网页遥控)。
终端按 Ctrl+C 退出并保存 `interactive.bin`。每次启动都加载当前固件构建的镜像段，
并保留 Flash 中的 NVS，避免一直运行旧固件；删除该文件即可使用保存的身份重新生成 Flash。
`task simulator:install` 只安装依赖并构建模拟器和网页，`task simulator:check` 检查启动身份的生成与复用、脚本、React 类型、音频封包、SSD1306 和底盘解码，以及小车位姿和发射器电量计算。

底盘端到端验收可在固件和模拟器构建后启动 `task simulator:run`，另开终端以 Node.js 24
依次执行 `node simulator/chassis-acceptance.mjs exercise`、`restart-zero`、`restart-final`。
`exercise` 预期全新模拟器状态的默认配置；已有状态可先备份并移走 `tmp/esp32sim-full-flow`。
每个阶段之间用 Ctrl+C 结束模拟器，再以相同命令启动；保留同一个 `interactive.bin`，
脚本会检查实际 PWM 变化、运动停止和 NVS 在两次重启后的恢复。

设备说话或聆听时再次说“小炮小炮”可打断。旧构建目录保留旧 sdkconfig 时唤醒词不会更新，
需在 ESP-IDF 配置界面修改，或移走 `tmp/build/<base-commit>/` 后重新构建。

仿真覆盖主要功能，不模拟射频干扰、电气特性和声学环境；
浮点初始估计值不保证与芯片逐位一致。独立的 Simulator CI 仅检查脚本、React 类型和音频封包，
不编译或运行模拟器；主分支实机固件构建沿用仓库现有 CI。
