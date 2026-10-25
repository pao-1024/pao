# PAO 模拟器

仿真通过本仓库的 `pao-sim` Rust 扩展，调用固定版本的
[esp32sim 内核](https://github.com/pao-1024/esp32sim)，
从芯片 ROM 启动 `task firmware:build` 生成的正式 PAO 镜像。
板型、I2S Codec、唤醒词识别、Opus 和灵矽协议均复用仓库固件。
`pao` 模拟板将 GPIO41/42 上 SSD1306 的真实 I2C 写入渲染为图像，并显示 GPIO48 状态灯。
网页使用电脑麦克风和扬声器与设备语音交互。

板型与 SSD1306 模型在 `pao-sim/src/`，React 网页与 AudioWorklet 在 `web/`。
内核 fork 维护通用 CPU、网络、Flash、I2S 支持和库入口，PAO 板型与页面在本仓库维护。
启动器复用内核 CLI 的初始化、固件加载、网络、重启及 Flash 保存逻辑，通过公开
`BoardModel` 接口挂载本地板型；不依赖动态插件 ABI。

`simulator/esp32sim/` 是 [pao-1024/esp32sim](https://github.com/pao-1024/esp32sim)
的 Git submodule，跟踪组织维护的 `pao` 分支，由父仓库的 gitlink 固定具体 commit。
内核固定在子模块版本；构建入口将仓库 I²S 扩展应用到 `tmp/studio-sim/` 隔离副本，原检出保持不变。修改 Rust 模型后使用 `task simulator:install` 构建，测试目标使用该目录下的 Cargo manifest。
`Cargo.lock` 固定 crate 依赖关系。
构建产物为 `tmp/esp32sim-build/release/pao-sim`，React 网页构建到 `tmp/simulator-web/`。

首次检出可运行 `git submodule update --init --recursive`；`task simulator:install` 也会初始化子模块。
安装始终使用父仓库记录的 commit，不会自动追随远端分支。内核升级时通过 PAO 的 PR
更新 gitlink；若子模块有本地改动，安装会停止而不覆盖。

## 启动

也可使用 PAO Studio 的仿真页管理本地环境、构建、启停和日志：运行
`task platform:dev`，在“仿真”页点击“准备环境 / 重新构建”。
对应命令 `task simulator:prepare` 将 ESP-IDF 6.0.1 和工具链安装到本工作目录
`tmp/esp-idf`、`tmp/idf-tools`，再构建固件与模拟器，不改变 EIM 的选择。
这个入口仍需要本机安装 Git、Python、Task、pnpm、Rust 及 C/C++ 构建工具。
首次下载、安装、编译需要联网；日志保留具体错误，失败后可以重新执行。

需要 Git、Python 3.10+、Task、Node.js 24+、pnpm 10.32.1 和稳定版 Rust 工具链。
ESP-IDF 使用主固件相同的 EIM 入口；先安装并选择 SDK，或激活已有 SDK 环境。
首次需要联网下载源码、组件及模拟器依赖，后续复用缓存。

在仓库根目录先构建正式固件，再一条命令构建模拟器、React 网页并启动：

```sh
task firmware:build
task simulator:run
```

启动器从已激活 ESP-IDF 环境的 `ESP_ROM_ELF_DIR` 自动定位 `esp32s3_rev0_rom.elf`；
未激活时优先读取 `task simulator:prepare` 安装到 `tmp/idf-tools` 的 ROM，
没有本地 ROM 时通过 `eim run` 读取当前选中环境的 ROM 目录。
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
  3D 视图按两轮占空比显示直行、转弯和原地旋转并留下轨迹，地面的距离圈和路锥作为参照物；
  速度按占空比线性换算，不代表实车距离，“复位”回到原点。
  发射器常供电，电量按 10 s 充满线性累积，继电器吸合时射出炮弹并清零；
  充满时间是假设值，实物测量后修改 `web/protocol.ts` 的 `FULL_CHARGE_S`。
- 接线与信号：ESP32-S3 到各模块的引脚连线，有通信的连线会高亮，并标出电平、占空比、采样率或流量。
- 总线通信：SSD1306 的 I2C 事务（解码后的命令和原始字节）、MX1508 的 MCPWM 占空比变化、
  GPIO 电平变化，以及两路 I2S 音频的统计，可按总线过滤或暂停。
- I2S 波形与 UART0 日志：日志支持关键字过滤，并从中解析设备状态。

顶栏“遥控”打开固件内置的遥控页 <http://127.0.0.1:8081/>，由启动器把本机 8081 端口转发到设备的 80 端口。

引脚数据由 `pao-sim/src/trace.rs` 采集：GPIO 和 I2C 来自板型回调，电机 PWM 由 MMIO 观察者
解码 MCPWM0 寄存器写入得到，每 50 ms 仿真时间通过同一个 WebSocket 推送一次。
建议戴耳机避免扬声器声音再次进入麦克风。麦克风和扬声器开启后保持打开，模拟器重启或断线重连后继续收音，
点击按钮或关闭页面才会关闭。说话时唤醒词识别会让仿真慢于实时，回复比实机慢；
启动器传入 `--max-lag 4`，仿真在静音时追回落后，不丢弃说话期间的音频。
终端按 Ctrl+C 退出并保存 `interactive.bin`。每次启动都加载当前固件构建的镜像段，
并保留 Flash 中的 NVS，避免一直运行旧固件；删除该文件即可使用保存的身份重新生成 Flash。
`task simulator:install` 只安装依赖并构建模拟器和网页，`task simulator:check` 检查启动身份的生成与复用、脚本、React 类型、音频封包、SSD1306 和底盘解码，以及小车位姿和发射器电量计算。

设备说话或聆听时再次说“小炮小炮”可打断。旧构建目录保留旧 sdkconfig 时唤醒词不会更新，
需在 ESP-IDF 配置界面修改，或移走 `tmp/build/<base-commit>/` 后重新构建。

仿真覆盖主要功能，不模拟射频干扰、电气特性和声学环境；
浮点初始估计值不保证与芯片逐位一致。Simulator CI 检查脚本、React 类型与音频封包，并构建模拟器、运行板型与 I²S 模型检查；ESP-IDF 应用闭环通过实际编译和运行验证，主分支实机固件构建沿用仓库现有 CI。

## 平台当前接线的业务应用仿真

React 工作台提供按当前接线和业务参数生成实时对讲、声音告警及诊断固件的入口，支持真实浏览器麦克风、独立/共享 I²S 时钟，见 [平台运行说明](../platform/README.md#esp32sim-真实运行时)。生成工程位于 `tmp/studio/<内容标识>/`；成功编译后也可运行 `python3 simulator/run-project.py tmp/studio/<内容标识>`。这些本地应用与上述 PAO 灵矽语音参考固件分别管理。
