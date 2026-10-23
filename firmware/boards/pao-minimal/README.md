# PAO 最小语音板

ESP32-S3，默认 16 MB Flash、八线 PSRAM。使用 Wi-Fi、I2S 数字麦克风
（如 INMP441）、I2S 功放（如 MAX98357A）、BOOT 按键和 WS2812 状态灯。
不需要屏幕、摄像头或独立音频 Codec。

GPIO 沿用上游 `bread-compact-wifi/config.h`，具体定义在本目录 `config.h`：

| 模块 | 信号 | GPIO |
| --- | --- | --- |
| I2S 麦克风 | WS / SCK / DIN | 4 / 5 / 6 |
| I2S 功放 | DIN / BCLK / LRC | 7 / 15 / 16 |
| BOOT 按键 | 低电平按下 | 0 |
| WS2812 状态灯 | 数据 | 48 |

麦克风采样率 16 kHz，扬声器播放采样率 24 kHz。BOOT 单击切换对话，
启动阶段单击进入配网；没有保存的网络时沿用小智配网流程。
默认未启用唤醒词，按键启动对话。板型和固件名称均为 `pao-minimal`，
不复用上游参考板的 OTA 标识。

这些是开发默认值，实物接线、电平、供电、Flash 和 PSRAM 必须核对后才能烧录。
本板没有电机或发射控制定义。
