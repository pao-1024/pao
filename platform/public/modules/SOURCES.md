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

## I²C 传感器

以下原版模块照片直接引用 Adafruit 官方 CDN，版权归 Adafruit，加载需要网络。引脚和制造几何来自 `src/sensors.ts` 中固定版本的官方 Eagle 源文件（CC BY-SA 3.0），不从照片估算。

- MCP9808 #1782 原版八针：https://cdn-shop.adafruit.com/640x480/1782-03.jpg ；https://learn.adafruit.com/adafruit-mcp9808-precision-i2c-temperature-sensor-guide/pinouts 。
- BH1750 #4681：https://cdn-shop.adafruit.com/640x480/4681-05.jpg ；https://learn.adafruit.com/adafruit-bh1750-ambient-light-sensor/pinouts 。
- SHT31-D #2857 原版七针：https://cdn-shop.adafruit.com/640x480/2857-03.jpg ；https://learn.adafruit.com/adafruit-sht31-d-temperature-and-humidity-sensor-breakout/pinouts 。

驱动寄存器依据 MCP9808 DS20001955、ROHM BH1750FVI 和 Sensirion SHT3x-DIS，交叉核对官方 Adafruit_MCP9808、Adafruit_CircuitPython_BH1750、Adafruit_SHT31 驱动。当前采用 MCP 连续转换、BH1750 连续高分辨率和 SHT31 单次高重复性测量模式；SHT31 不启用加热器。

## 电源与负载照片

以下照片直接引用厂商 CDN，用于型号识别，版权归原厂商，未复制到本仓库，也不适用上述 Fritzing SVG 的许可。加载需要网络。

- Adafruit #1466（5V/4A 电源）：https://www.adafruit.com/product/1466 ，图片 https://cdn-shop.adafruit.com/970x728/1466-10.jpg 。套件同时需要 #368 中心正极 2.1mm DC 转接端子：https://www.adafruit.com/product/368 。
- Adafruit #1314（4Ω/3W 扬声器）：https://www.adafruit.com/product/1314 ，图片 https://cdn-shop.adafruit.com/970x728/1314-07.jpg 。
- Pololu #992（100:1 Micro Metal Gearmotor LP 6V）：https://www.pololu.com/product/992 ，图片取自 https://www.pololu.com/product/992/pictures ，官方标称 6V 堵转电流 0.36A（外推值，不允许持续堵转）。

## 电气规则依据

- ESP32-S3-DevKitC-1 v1.1 原理图：https://dl.espressif.com/dl/schematics/SCH_ESP32-S3-DevKitC-1_V1.1_20221130.pdf 。RGB LED 接 GPIO38；供电方式互斥。
- 乐鑫尺寸图：https://dl.espressif.com/dl/schematics/esp_idf/DXF_ESP32-S3-DevKitC-1_V1.1_20220429.pdf 。板宽 25.4mm，排针距两侧板边各 1.27mm，因此两排中心距 22.86mm。
- OLED 旧版原理图：https://github.com/adafruit/Adafruit-128x32-I2C-OLED-Breakout-PCB/blob/8bcc38f98dbe399188a83ac2f394942b9bbe6e80/Adafruit%20OLED%20128x32%20Mono%20I2C.sch 。接口 R8/R9 上拉接 VIN，BSS138 在内部 3.3V 与接口之间转换；RST 有板载上拉，但旧版仍按官方接线由主控执行复位。不要混用带自动复位的新 STEMMA QT 版本。
- MAX98357A 电源、配置与差分输出：https://learn.adafruit.com/adafruit-max98357-i2s-class-d-mono-amp/pinouts 。
- SPH0645 供电、BCLK 与 SEL：https://learn.adafruit.com/adafruit-i2s-mems-microphone-breakout/pinouts 。
- DRV8833 默认休眠、开漏 FLT 和每通道 1A 默认限流：https://learn.adafruit.com/adafruit-drv8833-dc-stepper-motor-driver-breakout-board/pinouts 。

`electrical.ts` 中主控、OLED、麦克风的电流为项目预留额度，功放按厂商推荐 800mA，电机按 360mA/台保守预留。温升、USB 供电隔离状态与实物波形不由静态规则证明。
