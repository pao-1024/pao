# 固件仿真验证

仿真通过本仓库的 `pao-sim` Rust 扩展，调用固定版本的
[esp32sim 内核](https://github.com/pao-1024/esp32sim)，
从芯片 ROM 启动 `task firmware:build` 生成的正式 PAO 镜像。
板型、I2S Codec、WakeNet、Opus 和灵矽协议均复用仓库固件。
`pao` 模拟板将 GPIO41/42 上 SSD1306 的真实 I2C 写入渲染为图像，并显示 GPIO48 状态灯。
交互模式使用电脑麦克风和扬声器；自动验证使用 PCM 文件并保存 WAV。

板型与 SSD1306 模型在 `pao-sim/src/`，网页与 AudioWorklet 在 `web/`。
内核 fork 只维护通用 CPU、网络、Flash、I2S 支持和库入口，不包含 PAO 板型或页面。
启动器复用内核 CLI 的初始化、固件加载、网络、重启及 Flash 保存逻辑，通过公开
`BoardModel` 接口挂载本地板型；不依赖动态插件 ABI。

`esp32sim.json` 固定内核 commit；安装脚本将其检出到 `tmp/esp32sim/`，
再由本地 crate 的 path 依赖链接该源码缓存。`Cargo.lock` 固定 crate 依赖关系。
构建产物为 `tmp/esp32sim-build/release/pao-sim`，网页由本仓库直接维护和提供。

## 网页语音交互

完成一次下方的完整流程后，启动已配网、已激活的同一测试设备：

```sh
task firmware:sim:run -- \
  --rom '<ESP32-S3 ROM ELF 的绝对路径>' \
  --mac '<已激活测试设备的 MAC>'
```

打开 <http://127.0.0.1:8080/>，点击“启用麦克风和扬声器”并允许麦克风权限，
说“你好小智”后直接提问。网页同时显示 OLED、状态灯和 BOOT 按键。
无需 `--wake-input` 或 `--pcm-input`。建议戴耳机避免扬声器声音再次进入麦克风。
终端按 Ctrl+C 退出并保存独立的 `interactive.bin`，不会覆盖自动验证的 Flash。
更新模拟器版本后先运行 `task firmware:sim:install`。

## 环境与输入

需要 Git、Python 3.10+、Task 和稳定版 Rust 工具链。
ESP-IDF 使用主固件相同的 EIM 入口；先安装并选择 SDK，或激活已有 SDK 环境。
首次需要联网下载源码、组件及模拟器依赖，后续复用缓存。

准备两个 16 kHz、单声道、signed 16-bit little-endian 原始 PCM 文件：
`wake.pcm` 为“你好小智”，`input.pcm` 为提问。
脚本等待欢迎语播放结束再注入提问，无需预测云端回复耗时。
`--expected-asr` 指定提问应包含的文本，默认“介绍你自己”。

ROM 使用 ESP-IDF 工具包中的 `esp-rom-elfs/<版本>/esp32s3_rev0_rom.elf`。
自动验证使用专用已激活测试设备的 MAC 和 UUID；不要提交设备身份、音频或服务配置。

## 完整流程

在仓库根目录运行：

```sh
task firmware:sim:full -- \
  --rom '<ESP32-S3 ROM ELF 的绝对路径>' \
  --wake-input "$PWD/tmp/device/wake.pcm" \
  --pcm-input "$PWD/tmp/device/input.pcm" \
  --mac '<已激活测试设备的 MAC>' \
  --device-uuid '<已激活测试设备的 UUID>'
```

命令构建模拟器及正式固件，按顺序验证：

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

模拟器版本由 `esp32sim.json` 固定。`task firmware:sim:install` 单独构建模拟器，
`task firmware:sim:build` 单独构建正式固件。
已有构建时，可直接执行 `python3 firmware/simulation/esp32sim-flow.py` 并传入相同参数；
`--build`、`--emulator` 分别指定已有固件构建目录和模拟器。

仿真覆盖主要功能，不模拟射频干扰、电气特性和声学环境；
浮点初始估计值不保证与芯片逐位一致。CI 仅静态检查仿真脚本，
不编译或运行模拟器；主分支实机固件构建沿用仓库现有 CI。
