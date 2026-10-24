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
task simulator:run -- \
  --rom '<ESP32-S3 ROM ELF 的绝对路径>' \
  --mac '<已激活测试设备的 MAC>' \
  --device-uuid '<已激活测试设备的 UUID>'
```

ROM 使用 ESP-IDF 工具包中的 `esp-rom-elfs/<版本>/esp32s3_rev0_rom.elf`。
首次启动用 `--device-uuid` 生成 `tmp/esp32sim-full-flow/interactive.bin`，其 NVS 预置设备 UUID
和虚拟 AP `pao-sim-ap` 的凭据，固件开机直接联网激活；之后启动可省略 `--device-uuid`。
不要提交设备身份或服务配置。

打开 <http://127.0.0.1:8080/>，点击“启用麦克风和扬声器”并允许麦克风权限，
说“小炮小炮”后直接提问。网页包含以下内容：

- 设备：OLED、状态灯、小车 3D 视图，以及固件日志中最近的底盘和发射器指令。
  3D 视图按两轮占空比做差速积分，显示直行、转弯和原地旋转并留下行驶轨迹；
  地面的起点圆环、2 m 间隔的距离圈和路锥作为参照物，路锥随小车行驶在四周持续生成，同一位置每次相同；
  充能时炮管随电量发光，CH2 吸合时射出炮弹。速度按占空比线性换算，不代表实车距离，可用“复位”回到原点。
  网页模拟发射器电量：CH1 吸合期间按 5 秒充满线性累积，CH2 吸合时发射并清零，记录发射次数和上一发能量。
  充满时间是假设值，实物测量后修改 `web/protocol.ts` 的 `FULL_CHARGE_S`。
- 接线与信号：ESP32-S3 到各模块的引脚连线，有通信的连线会高亮，并标出电平、占空比、采样率或流量。
- 总线通信：SSD1306 的 I2C 事务（解码后的命令和原始字节）、MX1508 的 MCPWM 占空比变化、
  GPIO 电平变化，以及两路 I2S 音频的统计，可按总线过滤或暂停。
- I2S 波形与 UART0 日志：日志支持关键字过滤，并从中解析设备状态。

顶栏“遥控”打开固件内置的遥控页 <http://127.0.0.1:8081/>，由启动器把本机 8081 端口转发到设备的 80 端口。
3D 视图只在画面变化时绘制，小车静止时不占用 GPU。

引脚数据由 `pao-sim/src/trace.rs` 采集：GPIO 和 I2C 来自板型回调，电机 PWM 由 MMIO 观察者
解码 MCPWM0 寄存器写入得到，每 50 ms 仿真时间通过同一个 WebSocket 推送一次。
建议戴耳机避免扬声器声音再次进入麦克风。麦克风和扬声器开启后保持打开，模拟器重启或断线重连后继续收音，
点击按钮或关闭页面才会关闭。设备启动中或停止收音时，模拟器最多保留 0.5 s 未读的麦克风音频并丢弃更早的部分。
说话时唤醒词识别会让仿真慢于实时，此时音频排队不丢弃，启动器以 `--max-lag 4` 让仿真在静音时追回最多 4 s 的落后。
终端按 Ctrl+C 退出并保存 `interactive.bin`。每次启动都加载当前固件构建的镜像段，
并保留 Flash 中的 NVS，避免一直运行旧固件；删除该文件即可重新生成。
`task simulator:install` 只安装依赖并构建模拟器和网页，`task simulator:check` 检查脚本、React 类型、音频封包及 SSD1306 和底盘解码。

默认固件的唤醒词为“小炮小炮”，说话或聆听时再次说唤醒词可打断；旧构建目录保留旧 sdkconfig 时，需在 ESP-IDF
配置界面启用，或移走 `tmp/build/<base-commit>/` 后重新构建。

仿真覆盖主要功能，不模拟射频干扰、电气特性和声学环境；
浮点初始估计值不保证与芯片逐位一致。独立的 Simulator CI 仅检查脚本、React 类型和音频封包，
不编译或运行模拟器；主分支实机固件构建沿用仓库现有 CI。
