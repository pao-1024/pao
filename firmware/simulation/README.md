# 固件仿真验证

使用固定版本的 [PAO QEMU fork](https://github.com/pao-1024/qemu)，运行 ESP32-S3
的 I2S/GDMA、SSD1306 OLED、GPIO0 BOOT 按键和 GPIO48 WS2812。
小智仿真板沿用真实 I2S Codec、音频处理、Opus 和服务协议，以 OpenETH 替代 Wi-Fi。
左右电机通过实际 GPIO/MCPWM 输出验证方向和占空比；另有一个仅供仿真显示亮灭的虚拟小灯。

## 本机依赖

需要 Git、Python 3.10+、Task，以及 QEMU 的本机编译工具。

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
首次需要联网获取源码、组件和 QEMU 的构建依赖，后续复用缓存。

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
`reply.wav`，画面在 `oled.pbm`。脚本单独检查 ASR 后的非静音输出，防止将启动提示音
误认为 TTS 播放。仿真使用 Flash/eFuse 的临时写入层，不改写输入
镜像；运行中从 OTA 获得的服务配置不会保存回输入文件。

仅构建固件可运行 `task firmware:qemu:build`。它使用独立的
`tmp/build/<base-commit>-qemu/` 目录，不覆盖实机固件。
已有构建时可直接运行 `python3 firmware/simulation/qemu.py`，用 `--build` 和 `--qemu`
指定本地目录或可执行文件。脚本共用一个 QMP socket，同一 worktree 中不要并行运行。

## 唤醒词与配网完整流程

在 `tmp/device/wake-flow.pcm` 准备 16 kHz 单声道 s16le 音频：先一秒静音、
“你好小智”、一秒静音，再说“你好，请用一句话介绍你自己。”，最后三秒静音。
脚本在检测到唤醒后暂停输入文件，等欢迎语播放结束再继续输入提问，
不需要预测云端回复耗时。可用 `--expected-asr` 修改提问应包含的文本。

```sh
task firmware:sim:full -- \
  --pcm-input "$PWD/tmp/device/wake-flow.pcm" \
  --efuse "$PWD/tmp/device/efuse.bin" \
  --device-uuid '<已激活测试设备的 UUID>'
```

命令安装固定版本的乐鑫 esp-emu，运行 QEMU 外设/浮点/重启探针，
构建两个仿真板型并按顺序验证：

1. 新建不含 SSID 的 NVS，在 esp-emu 启动固件自己的 SoftAP。
2. 虚拟客户端加入热点，经 DHCP 获取地址，访问真实配置页并扫描虚拟 AP。
3. 拒绝超长 SSID，提交正确凭据，检查保存列表、取得 IP 和灵矽连接。
4. 保存 Flash 后重启，检查自动重连；再使用错误 AP 密码，检查连接失败且未取得 IP。
5. 从保存的 Flash 提取 NVS，将同一设备身份和配网结果交给 QEMU。
6. 经真实 I2S/GDMA 注入语音，检查 WakeNet 唤醒、指定提问的 ASR、助手回复、
   非静音 TTS 和返回 listening；读取 OLED 画面。

默认总超时 240 秒。`--device-uuid` 默认随机生成；真实服务要求先激活该身份，
自动验证建议使用专用已激活设备。输入 eFuse 不会被改写；测试产生的 Flash/NVS
含设备配置，只保存在忽略的 `tmp/` 下。重复运行会重新开始配网并覆盖上次结果。

总结果为 `tmp/full-flow/result.json`，配网、重启和密码错误日志在同一目录，
语音结果及 `reply.wav`、`oled.pbm` 在 `tmp/qemu-wake/`。
已有构建时可直接执行 `python3 firmware/simulation/full-flow.py` 并传入相同参数。
单独验证唤醒和对话可运行 `task firmware:qemu:wake -- ...`。

负例验证使用不含唤醒词的普通语音；文件结束后补静音，运行 12 秒输入并断言没有唤醒：

```sh
python3 firmware/simulation/qemu.py wake-negative \
  --pcm-input "$PWD/tmp/device/input.pcm" \
  --efuse "$PWD/tmp/device/efuse.bin" --nvs "$PWD/tmp/device/nvs.bin"
```

这里使用两个后端，且使用各自板型固件。QEMU 没有 S3 Wi-Fi 模型，语音阶段通过
OpenETH 联网；esp-emu v0.50.0 的 `recip0.s`/`rsqrt0.s` 运算不能满足当前 WakeNet，
且没有 I2S 麦克风输入接口，因此其配网板型禁用唤醒并使用静音 Codec。
这套入口覆盖功能流程，不代表单个模拟器已经运行所有硬件。乐鑫模拟器依赖
[官方 v0.50.0 二进制发行包](https://github.com/espressif/esp-emulator/releases/tag/v0.50.0)，
当前安装脚本支持 macOS ARM64、Linux ARM64/x86_64，并校验发行包 SHA-256。

## 仿真范围

这是当前语音板的功能模型，不等同于完整芯片或电气仿真。I2S 固定为本板的单声道
32 位槽格式，输入文件对应 16 kHz 麦克风，输出对应 24 kHz 功放；OLED 读回显示 RAM，
未模拟对比度和模拟亮度。Wi-Fi 配网和凭据持久化使用乐鑫模拟器验证；
射频、实际声音质量、声学回声消除、任意 GPIO 矩阵路由或其他 I2C/RMT 器件未验证。
WakeNet 使用“你好小智”模型；QEMU 浮点初始估计值支持功能推理，未做到芯片查表结果逐位一致。
仿真配置使用软件 AES/SHA 实现。
ADC 只提供启动所需的接地校准行为。
PSRAM tuning 会输出回退警告，当前验证不覆盖真实板子的时序校准。QEMU VM 快照和迁移不受支持。

QEMU 源码版本由 `qemu.json` 固定；升级后应重新运行外设探针、完整流程和唤醒负例。
CI 静态检查覆盖仿真源码。PR 仅运行静态检查；主分支保留实机固件构建及产物上传，
不在 CI 编译或运行仿真。
