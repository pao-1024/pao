# PAO 模拟器

仿真通过本仓库的 `pao-sim` Rust 扩展，调用固定版本的
[esp32sim 内核](https://github.com/pao-1024/esp32sim)，
从芯片 ROM 启动 `task firmware:build` 生成的正式 PAO 镜像。
板型、I2S Codec、WakeNet、Opus 和灵矽协议均复用仓库固件。
`pao` 模拟板将 GPIO41/42 上 SSD1306 的真实 I2C 写入渲染为图像，并显示 GPIO48 状态灯。
交互模式使用电脑麦克风和扬声器；自动验证使用 PCM 文件并保存 WAV。

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

## 网页语音交互

先构建正式固件并完成一次下方的命令行验证，准备好已配网、已激活的 Flash。
随后一条命令构建模拟器、React 网页并启动同一测试设备：

```sh
task simulator:run -- \
  --rom '<ESP32-S3 ROM ELF 的绝对路径>' \
  --mac '<已激活测试设备的 MAC>'
```

打开 <http://127.0.0.1:8080/>，点击“启用麦克风和扬声器”并允许麦克风权限，
说“你好小智”后直接提问。网页同时显示 OLED、状态灯和 BOOT 按键。
无需 `--wake-input` 或 `--pcm-input`。建议戴耳机避免扬声器声音再次进入麦克风。
终端按 Ctrl+C 退出并保存独立的 `interactive.bin`，不会覆盖自动验证的 Flash。
每次启动都加载当前固件构建的镜像段，并保留交互 Flash 中的 NVS，避免一直运行旧固件。
`task simulator:install` 只安装依赖并构建模拟器和网页，`task simulator:check` 检查脚本、React 类型及音频封包。

两个 Python 入口用途不同：`run-esp32sim.py` 启动持续运行的网页交互，使用电脑麦克风，
退出时保存独立的交互 Flash；`esp32sim-flow.py` 用音频文件自动驱动配网和对话，
检查结果并退出，供开发时回归验证使用，不是交互启动入口。

## 环境与输入

需要 Git、Python 3.10+、Task、Node.js 24+、pnpm 10.32.1 和稳定版 Rust 工具链。
ESP-IDF 使用主固件相同的 EIM 入口；先安装并选择 SDK，或激活已有 SDK 环境。
首次需要联网下载源码、组件及模拟器依赖，后续复用缓存。

准备两个 16 kHz、单声道、signed 16-bit little-endian 原始 PCM 文件：
`wake.pcm` 为“你好小智”，`input.pcm` 为提问。
脚本等待欢迎语播放结束再注入提问，无需预测云端回复耗时。
`--expected-asr` 指定提问应包含的文本，默认“介绍你自己”。

ROM 使用 ESP-IDF 工具包中的 `esp-rom-elfs/<版本>/esp32s3_rev0_rom.elf`。
自动验证使用专用已激活测试设备的 MAC 和 UUID；不要提交设备身份、音频或服务配置。

## 命令行回归验证

在仓库根目录运行：

```sh
task firmware:build
task simulator:install
python3 simulator/esp32sim-flow.py \
  --rom '<ESP32-S3 ROM ELF 的绝对路径>' \
  --wake-input "$PWD/tmp/device/wake.pcm" \
  --pcm-input "$PWD/tmp/device/input.pcm" \
  --mac '<已激活测试设备的 MAC>' \
  --device-uuid '<已激活测试设备的 UUID>'
```

Python 入口使用已构建的模拟器和正式固件，按顺序验证：

1. 新建不含 SSID 的 NVS，从 ROM 启动固件，初始化 OLED 并开启 SoftAP。
2. 虚拟客户端加入热点，经 DHCP 获取地址，访问真实配置页并扫描虚拟 AP。
3. 提交 WPA2 凭据，检查保存列表、取得 IP 和灵矽激活完成。
4. 保存 Flash 后冷启动同一镜像，检查凭据自动重连。
5. 经真实 I2S/GDMA 注入唤醒词和提问，检查 WakeNet、指定 ASR、两次播放结束、
   回答阶段非静音 I2S 输出和返回 listening。
6. 模拟 GPIO0 短按，确认固件按键回调关闭会话并返回 idle。

每轮模拟器默认主机超时 300 秒，可用 `--timeout` 调整。
重复运行重新开始配网并覆盖上次结果；运行锁阻止同一 worktree 中的并发验证。
默认固件启用“你好小智” WakeNet；旧构建目录保留旧 sdkconfig 时，需在 ESP-IDF
配置界面启用，或移走 `tmp/build/<base-commit>/` 后重新构建。

## 结果与维护

结果保存在 Git 忽略的 `tmp/esp32sim-full-flow/`：

- `result.json`：正式固件 SHA-256、配网重连、OLED、唤醒、ASR、音频及按键结果。
- `provision.log`、`voice.log`：配网和冷启动语音日志。
- `speaker.wav`：实际 I2S 扬声器输出。
- `provision-oled.png`、`oled.png`：两轮运行的屏幕画面。
- Flash/NVS：含测试设备配置，仅供本地复跑。

模拟器版本由子模块 gitlink 固定。`task simulator:install` 单独构建模拟器和网页，
`task firmware:build` 单独构建正式固件。
已有构建时，可直接执行 `python3 simulator/esp32sim-flow.py` 并传入相同参数；
`--build`、`--emulator` 分别指定已有固件构建目录和模拟器。

仿真覆盖主要功能，不模拟射频干扰、电气特性和声学环境；
浮点初始估计值不保证与芯片逐位一致。独立的 Simulator CI 仅检查脚本、React 类型和音频封包，
不编译或运行模拟器；主分支实机固件构建沿用仓库现有 CI。
