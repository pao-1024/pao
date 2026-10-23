# QEMU 语音板验证

使用固定版本的 [PAO QEMU fork](https://github.com/pao-1024/qemu)，运行 ESP32-S3
的 I2S/GDMA、SSD1306 OLED、GPIO0 BOOT 按键和 GPIO48 WS2812。
小智仿真板沿用真实 I2S Codec、音频处理、Opus 和服务协议，以 OpenETH 替代 Wi-Fi。
电机和发射控制不在该固件中。

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

ESP-IDF 使用主固件相同的自动安装入口；设置了 `IDF_PATH` 时复用已有 SDK。
首次需要联网获取源码、组件和 QEMU 的构建依赖，后续复用缓存。

## 离线外设验证

在仓库根目录运行：

```sh
task firmware:qemu:probe
```

命令构建固定版本的 QEMU 和 ESP-IDF 探针，验证 NVS 写入后重新初始化读回、
I2C 地址 NACK、SSD1306 全屏像素、WS2812 RGB、I2S 输入及输出采样内容、
按键按下和松开，并在 machine reset 后再运行一轮。失败返回非零状态。

结果在 `tmp/qemu-probe/result.json`，串口日志为 `uart.log`，屏幕为 `oled.pbm`，
扬声器音频为 `speaker.wav`。这项验证不连接云服务，也不使用真实设备身份。

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

## 仿真范围

这是当前语音板的功能模型，不等同于完整芯片或电气仿真。I2S 固定为本板的单声道
32 位槽格式，输入文件对应 16 kHz 麦克风，输出对应 24 kHz 功放；OLED 读回显示 RAM，
未模拟对比度和模拟亮度。没有验证 Wi-Fi 配网、射频、实际声音质量、声学回声消除、
唤醒词、任意 GPIO 矩阵路由或其他 I2C/RMT 器件。仿真配置使用软件 AES/SHA 实现。
ADC 只提供启动所需的接地校准行为。
PSRAM tuning 会输出回退警告，当前验证不覆盖真实板子的时序校准。QEMU VM 快照和迁移不受支持。

QEMU 源码版本由 `qemu.json` 固定；升级后应重新运行外设探针和语音会话。
CI 只做代码静态检查，不编译、运行仿真或上传固件。
