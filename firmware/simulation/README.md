# 固件仿真验证

固件统一使用仓库的 `firmware/boards/pao/pao_board.cc`、PAO 组件和固定版本小智应用，
没有独立的仿真板级实现或静音 Codec。`sim:full` 使用
[PAO esp32sim fork](https://github.com/pao-1024/esp32sim)，直接运行 `task firmware:build`
生成的正式固件，验证 Wi-Fi 首次配网、持久化重连、真实 WakeNet 和灵矽语音问答。
QEMU 使用相同 `PaoBoard`、I2S Codec、音频处理、Opus 和服务协议；
其配置增加 OpenETH 网络适配，并使用模拟器支持的密码实现。
这仍是不同配置编译的镜像，不能视为正式 Wi-Fi 镜像在 QEMU 原样跑通。

固定版本的 [PAO QEMU fork](https://github.com/pao-1024/qemu) 提供 ESP32-S3
I2S/GDMA、GPIO0、GPIO48 和 MCPWM 功能模型。正式 PAO 固件接入 SSD1306 OLED；
esp32sim 的 `pao` 板型将其真实 I2C 写入渲染为图像，QEMU 另有独立外设探针。
左右电机通过实际 GPIO/MCPWM 输出验证方向和占空比；另有一个仅供仿真显示亮灭的虚拟小灯。

esp32sim 从芯片 ROM 启动同一个正式镜像，处理真实 Wi-Fi 协议、I2S/GDMA、
PSRAM、浮点及 SIMD 指令。麦克风由主机 PCM 输入，扬声器输出保存为 WAV。

## 本机依赖

完整语音流程需要 Git、Python 3.10+、Task 和稳定版 Rust 工具链。
QEMU 外设探针另外需要下列本机编译工具。

macOS：

```sh
brew install ninja pkg-config glib pixman libgcrypt libslirp
```

Ubuntu 24.04：

```sh
sudo apt-get install build-essential git python3 python3-venv ninja-build pkg-config \
  libglib2.0-dev libpixman-1-dev libgcrypt20-dev libslirp-dev
```

ESP-IDF 使用主固件相同的 EIM 入口；需先安装并选择 SDK，或激活已有的 SDK 环境。
首次需要联网获取源码、组件和模拟器依赖，后续复用缓存。

## 离线外设验证

在仓库根目录运行：

```sh
task firmware:qemu:probe
```

命令构建固定版本的 QEMU 和 ESP-IDF 探针，验证 NVS 写入后重新初始化读回、
I2C 地址 NACK、SSD1306 全屏像素、WS2812 RGB、I2S 输入及输出采样内容、
按键按下和松开、WakeNet 使用的浮点指令，并在 machine reset 后再运行一轮。
失败返回非零状态。

结果在 `tmp/qemu-probe/result.json`，串口日志为 `uart.log`，屏幕为 `oled.pbm`，
扬声器音频为 `speaker.wav`。这项验证不连接云服务，也不使用真实设备身份。

探针还提供纯软件的模拟事件占位：观察到虚拟按键按下时输出 `SIM_EVENT ... indicator=ON`，
观察到松开后输出 `indicator=OFF`，跨两轮重启记录到 `result.json` 的
`virtual_indicator_events`，并生成 `indicator.svg` 显示亮灯/灭灯记录。
这个指示灯只存在于主机报告中，不映射设备寄存器、GPIO 或执行机构，也不代表任何外设控制已验证。

电机模型读取固件实际写入 GPIO11–14 的输出，按照
[MX1508 Rev1.3 数据手册的真值表](https://pcb.daince.net/_media/2wd_project_v100:584fa0ef01fdf-1.pdf)
解释每路两个输入：`00` 待机、`10` 正转、`01` 反转、`11` 刹车。
探针遍历左右两路的全部 16 种组合，并在第二轮重启后重复验证，结束时关闭输出。
结果写入 `result.json` 的 `motor_events`，`motors.svg` 用颜色和文字展示两路状态。
这里的正反转是驱动器的逻辑方向，不推断装配后的小车前后方向；不计算转速、惯性或负载。
探针还链接正式 `Motor`/`Chassis` 组件，经真实 ESP-IDF MCPWM 驱动验证正反转、
0–100% 占空比、停止、越界限幅、非有限输入归零，以及底盘前进、后退、原地转向和混合转向。
16 个驱动状态跨两轮重启检查，结果写入 `pwm_events`，占空比也显示在 `motors.svg`。
MCPWM 模型读取 GPIO 矩阵路由、定时器、比较器和强制电平配置，不生成 PWM 边沿或电机转速。
QEMU 语音板与正式板一样创建电机和底盘，上电保持停止；尚未接入上层运动指令。

## 灵矽语音会话

准备 16 kHz、单声道、signed 16-bit little-endian 的原始 PCM 输入，以及测试设备的
QEMU eFuse 文件和 16 KB NVS 分区镜像。NVS 的 `board/uuid` 和 eFuse 的 MAC 应与
已激活设备一致；不要提交设备配置或服务凭据。QEMU eFuse 文件是模拟器格式，
不能直接用任意真机 eFuse dump 替代。

```sh
task firmware:qemu:run -- \
  --pcm-input "$PWD/tmp/device/input.pcm" \
  --efuse "$PWD/tmp/device/efuse.bin" \
  --nvs "$PWD/tmp/device/nvs.bin"
```

该命令构建仿真固件并连接当前配置的灵矽 OTA 服务。脚本通过 GPIO0 模拟按键，
等待进入 listening 后注入 PCM，检查 ASR 文本、助手回复、音频播放和返回 listening。
输入文件结束后麦克风提供静音。默认超时 180 秒，可传入 `--timeout` 调整。
设备尚未激活时，需要在 `tmp/qemu-voice/uart.log` 中查看激活码并完成服务端激活。

结果在 `tmp/qemu-voice/result.json`，完整音频在 `speaker.wav`，ASR 完成后的回复音频在
`reply.wav`。QEMU 的 OLED 寄存器与像素行为由外设探针单独检查。
脚本单独检查 ASR 后的非静音输出，防止将启动提示音
误认为 TTS 播放。仿真使用 Flash/eFuse 的临时写入层，不改写输入
镜像；运行中从 OTA 获得的服务配置不会保存回输入文件。

仅构建网络适配配置可运行 `task firmware:qemu:build`。它使用独立的
`tmp/build/<base-commit>-qemu/` 目录，不覆盖实机固件。
已有构建时可直接运行 `python3 firmware/simulation/qemu.py`，用 `--build` 和 `--qemu`
指定本地目录或可执行文件。脚本共用一个 QMP socket，同一 worktree 中不要并行运行。

## 唤醒词与配网完整流程

分别准备 16 kHz 单声道 s16le 的“你好小智”和提问音频。
脚本等待欢迎语播放结束再注入提问，不需要预测云端回复耗时。
可用 `--expected-asr` 修改提问应包含的文本。ROM 使用 ESP-IDF 工具包中的
`esp-rom-elfs/<版本>/esp32s3_rev0_rom.elf`。

```sh
task firmware:sim:full -- \
  --rom '<ESP32-S3 ROM ELF 的绝对路径>' \
  --wake-input "$PWD/tmp/device/wake.pcm" \
  --pcm-input "$PWD/tmp/device/input.pcm" \
  --mac '<已激活测试设备的 MAC>' \
  --device-uuid '<已激活测试设备的 UUID>'
```

命令构建固定版本的 esp32sim 和正式 PAO 固件，按顺序验证：

1. 新建不含 SSID 的 NVS，从 ROM 启动正式固件，初始化 OLED 并开启自己的 SoftAP。
2. 虚拟客户端加入热点，经 DHCP 获取地址，访问真实配置页并扫描虚拟 AP。
3. 提交 WPA2 凭据，检查保存列表、取得 IP 和灵矽激活完成。
4. 保存 Flash 后冷启动同一个镜像，检查凭据自动重连。
5. 经真实 I2S/GDMA 注入唤醒词和提问，检查 WakeNet、指定提问的 ASR、
   欢迎语及回答播放完成、非静音 I2S 输出和返回 listening。
6. 在回答播放结束后模拟 GPIO0 的真实短按，确认按键回调关闭会话并返回 idle。

每轮模拟器默认主机超时 300 秒。真实服务要求设备身份已激活，
自动验证使用专用测试设备的 MAC 和 UUID。测试产生的 Flash/NVS
含设备配置，只保存在忽略的 `tmp/` 下。重复运行重新开始配网并覆盖上次结果；
同一 worktree 的运行锁阻止多个流程同时写入证据目录。

结果为 `tmp/esp32sim-full-flow/result.json`，配网日志、冷启动语音日志、
`speaker.wav`、`provision-oled.png` 和 `oled.png` 在同一目录。
结果记录两轮使用的正式固件 SHA-256、OLED 初始化及实际 ASR。
已有构建时可直接执行 `python3 firmware/simulation/esp32sim-flow.py` 并传入相同参数。
`--build` 和 `--emulator` 可指定已有构建目录和模拟器。
默认固件启用“你好小智” WakeNet；旧构建目录保留旧 sdkconfig 时需通过
ESP-IDF 配置界面启用，或移走对应 `tmp/build/<base-commit>/` 后重新构建。
单独验证唤醒和对话可运行 `task firmware:qemu:wake -- ...`。

负例验证使用不含唤醒词的普通语音；文件结束后补静音，运行 12 秒输入并断言没有唤醒：

```sh
python3 firmware/simulation/qemu.py wake-negative \
  --pcm-input "$PWD/tmp/device/input.pcm" \
  --efuse "$PWD/tmp/device/efuse.bin" --nvs "$PWD/tmp/device/nvs.bin"
```

QEMU 的独立语音入口继续使用 OpenETH 配置，适合外设诊断；
正式固件的完整配网和语音验收由 esp32sim 入口完成。

## 仿真范围

这是当前语音板的功能模型，不等同于完整芯片或电气仿真。I2S 固定为本板的单声道
32 位槽格式，输入文件对应 16 kHz 麦克风，输出对应 24 kHz 功放；OLED 读回显示 RAM，
未模拟对比度和模拟亮度。Wi-Fi 配网和凭据持久化使用 esp32sim 验证；
射频、实际声音质量、声学回声消除、任意 GPIO 矩阵路由或其他 I2C/RMT 器件未验证。
WakeNet 使用“你好小智”模型；QEMU 浮点初始估计值支持功能推理，未做到芯片查表结果逐位一致。
QEMU 配置使用软件 AES/SHA 实现；esp32sim 使用正式固件配置。
ADC 只提供启动所需的接地校准行为。
PSRAM tuning 会输出回退警告，当前验证不覆盖真实板子的时序校准。QEMU VM 快照和迁移不受支持。

模拟器源码版本分别由 `qemu.json` 和 `esp32sim.json` 固定；升级后重新运行对应验证。
CI 静态检查覆盖仿真源码。PR 仅运行静态检查；主分支保留实机固件构建及产物上传，
不在 CI 编译或运行仿真。
