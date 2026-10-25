# 器件图像与引脚资料

图像仅作器件识别。UI 端子面板是逻辑引出，不表示照片中的针序、机械尺寸或经过核实的 PCB 封装。连接器名称需对照所购板卡的版本和丝印。

## Espressif

- `esp.png`：ESP32-S3-DevKitC-1 v1.1 官方照片，未修改。
- 作者：Espressif Systems。
- 来源：https://github.com/espressif/esp-dev-kits/blob/bd4d4ac18657e73583af3d7c0b0a23c3cddf3735/docs/_static/esp32-s3-devkitc-1/esp32-s3-devkitc-1-v1.1-isometric.png
- 许可：CC BY-SA 4.0，随附 `ESPRESSIF-LICENSE.txt`。https://creativecommons.org/licenses/by-sa/4.0/
- 44 针定义：https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html#header-block

## Adafruit

以下 SVG 从 Adafruit 官方 Fritzing 元件包的 breadboard 视图提取，文件内容未修改。作者：Adafruit Industries。许可：CC BY-SA 3.0，随附 `ADAFRUIT-LICENSE.txt`。https://creativecommons.org/licenses/by-sa/3.0/

固定来源：https://github.com/adafruit/Fritzing-Library/tree/6fe4856351c504d627c973129a01c5a8df1387ac/parts

- `oled.svg`：`Adafruit OLED Monochrome 128x32 I2C.fzpz`，Adafruit #931，SSD1306 六针模块；https://learn.adafruit.com/monochrome-oled-breakouts/wiring-128x32-i2c-display
- `mic.svg`：`Adafruit I2S Mic -  SPH0645.fzpz`，Adafruit #3421；https://learn.adafruit.com/adafruit-i2s-mems-microphone-breakout/pinouts
- `amp.svg`：`Adafruit MAX98357A.fzpz`，Adafruit #3006；https://learn.adafruit.com/adafruit-max98357-i2s-class-d-mono-amp/pinouts
- `motor.svg`：`Adafruit DRV8833 DC-Stepper Motor Driver.fzpz`，Adafruit #3297；https://learn.adafruit.com/adafruit-drv8833-dc-stepper-motor-driver-breakout-board/pinouts

端子别名：SPH0645 的 DATA / SELECT 对应面板 DOUT / SEL；MAX98357A 的 LRCLK / VO+ / VO− 对应 LRC / OUT_PLUS / OUT_MINUS；DRV8833 的 PWRIN / NFAULT / !SLEEP 对应 VMOTOR / FLT / SLP。DRV8833 的 VM、ASEN、BSEN 没有在此编辑器开放。不能把该驱动或 SPH0645 当作 PAO 原板型的 MX1508 / INMP441。
