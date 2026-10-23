# PAO 模块接线图

使用 [tscircuit](https://tscircuit.com/) 的 TSX 描述用户提供的[小智机器人接线方案](reference-wiring.jpg)。本版按图连接供电、ESP32-S3、MX1508 电机驱动小红板、INMP441、MAX98357、扬声器和 SSD1306 OLED，省略图中标注可选的三个外接按钮。

这是**模块之间的接线参考**，尚未实物验证。符号中的 `pin1` 等仅为逻辑索引；接线按 GPIO 名称和模块丝印确认。本目录仅用于模块接线，未验证 PCB 封装、机械尺寸或模块内部电路，不生成可生产的 PCB。

![由 TSX 生成的原理图](schematic.svg)

## 模块与供电

| 图中模块 | 本版描述 |
| --- | --- |
| 1S 锂电池 | 电池正负极接充电保护板 B+/B− |
| 1S 充电保护板 | 采用已有 TP4056 保护板接口参考；自带 USB 充电口，负载使用 OUT+/OUT− |
| 三脚开关 | COM 与 ON 串联在保护板 OUT+ 和升压输入之间，另一脚不接 |
| 5V 升压板 | 采用已有 MT3608 四端子接口参考；输出设为 5V，给主控与电机驱动供电 |
| ESP32-S3 开发板 | 按原图的 44 针 DevKitC 排针名称描述，板载稳压输出 3V3 |
| MX1508 电机驱动小红板 | 型号已确认；描述电源、IN1–IN4、左右两路电机输出 |
| INMP441 麦克风 | 3V3，I2S 输入 |
| MAX98357 功放及扬声器 | 按原图 VIN 接 3V3，I2S 输出至差分扬声器端子 |
| SSD1306 I2C OLED | VCC 接 3V3；目标为图中标注的 128×64，尺寸与分辨率以实物为准 |

原图将小红板标作 L298N，实际型号已确认是 **MX1508**。IN1/IN2 控制右电机，IN3/IN4 控制左电机，电源接升压板的 5V 输出。充电板与升压板的实际芯片型号尚未确认，上述选型仅复用同类模块的接口定义。

## 现成组件与来源

- **电池与开关**：使用 tscircuit 内置的 [`<battery />`](https://docs.tscircuit.com/elements/battery) 和 [SPDT 开关](https://docs.tscircuit.com/elements/switch)，保留原图的正极开关及空置脚。`PowerSwitch` 仅处理 React 同名 SVG 标签的类型冲突，运行时仍使用库的内置开关。
- **OLED**：直接从官方 [`@tscircuit/header-modules`](https://github.com/tscircuit/header-modules) 导入 `Generic096InSSD1306OLEDI2CModule`。该包尚未发布到 npm，依赖固定到 GitHub 提交；复用其引脚、属性和符号定义。
- **充电保护与升压模块**：从已有 MIT 许可的 Fritzing/KiCad 板级定义适配为可直接导入的 `Tp4056Protection` 与 `Boost5VModule`。原始定义、许可和必要修正见 [vendor/README.md](vendor/README.md)。入口只负责把模块连接起来。

其余模块当前保留按参考图核对过的接口符号。库中同名组件仍需核对引脚，不能仅凭名称替换；例如官方 header-modules 的同名 ESP32-S3 组件目前是 30 针映射，与本图 44 针开发板不符。

## 信号连接

下表与原图一致，可直接作为固件的 GPIO 配置依据。

| 模块 | 信号 | ESP32-S3 GPIO | DevKitC-1 排针位置 |
| --- | --- | --- | --- |
| INMP441 | WS | 4 | J1-4 |
| INMP441 | SCK / BCLK | 5 | J1-5 |
| INMP441 | SD，麦克风输出 | 6 | J1-6 |
| MAX98357 | DIN，功放输入 | 7 | J1-7 |
| MAX98357 | BCLK | 15 | J1-8 |
| MAX98357 | LRC / LRCLK | 16 | J1-9 |
| MX1508 | IN1，右轮 | 11 | J1-17 |
| MX1508 | IN2，右轮 | 12 | J1-18 |
| MX1508 | IN3，左轮 | 13 | J1-19 |
| MX1508 | IN4，左轮 | 14 | J1-20 |
| OLED | SDA | 41 | J3-7 |
| OLED | SCL | 42 | J3-6 |

电源排针：5V 为 J1-21，3V3 为 J1-1/J1-2，GND 可用 J1-22 或 J3-1/J3-21/J3-22。位置依据[乐鑫 DevKitC-1 引脚表](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html#header-block)；手中开发板的型号、方向和丝印仍需一致。

GPIO39、40、0 的三个外接按钮未接入，板载 BOOT/RESET 不受影响。GPIO41/42 用于 OLED 后会占用对应的外部 JTAG 引脚；USB GPIO19/20 保留。

## 电源与固定连接

```text
1S 电池 B+/B− → 充电保护板
保护板 OUT+ → 开关 COM/ON → 升压板 VIN+
保护板 OUT− → 升压板 VIN−/VOUT− → 系统 GND
升压板 VOUT+（5V）→ ESP32-S3 5V、电机驱动 VCC
ESP32-S3 3V3 → 麦克风 VDD、功放 VIN/SD、OLED VCC
```

- 电池负极 B− 与系统 GND 分开，负载通过保护板 OUT− 回流，避免绕过保护。开关的实际公共脚须按丝印或通断测量确认；图中的开关符号只表示外部接线，不模拟开关状态。充电口内置于充电板，未另画连接器；未知模块是否有电源路径管理，充电时关闭系统开关。
- 电机供电从升压输出直接分支，电机电流不经过开发板排针或 3V3 稳压器。核对电池、保护板、升压板和驱动板能否承受电机堵转与整机峰值电流。
- 功放保持原图的 **3V3 供电**。实际音量和扬声器负载必须在开发板 3V3 稳压器的电流余量内；模块应有厂家要求的去耦。切换供电方案时同步修改 TSX、测试和接线表。
- 麦克风 L/R 接 GND，选择左声道。原图未画出 SD 的 100kΩ 下拉和去耦，应确认模块已包含厂家要求的外围电路；若引出 CHIPEN 则确认已使能。[INMP441 数据手册](https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf)
- 功放 SD_MODE 接 3V3，GAIN 接 GND，按 MAX98357A 对应左声道及 12dB 增益。扬声器只接 OUT+ 与 OUT−，两端均不接系统 GND。[MAX98357A/B 数据手册](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX98357A-MAX98357B.pdf)
- OLED 按 **SDA/SCL/VCC/GND 丝印**接线。不同模块的四针排列、尺寸和分辨率可能不同，不能按照片的排针次序替代丝印；本版假定模块已包含 I2C 上拉。
- 按[乐鑫供电说明](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html#power-supply-options)，USB、5V 排针、3V3 排针供电方式互斥。下载固件时切换供电，避免同时从外部升压板和 USB 向开发板供电。

## 本地预览与验证

需要 **Node.js 24+、npm 和 Bun 1.3.10+**。当前锁定版本的 `tsci` 命令使用 Bun 运行；[Bun 安装说明](https://bun.sh/docs/installation)。从仓库根目录执行：

```sh
cd hardware
npm ci
npm run dev
```

浏览器访问命令输出的本地地址（默认 `http://localhost:3020`），查看 Schematic。PCB 已关闭，预览中的 PCB/3D 不代表实际布局。

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | 严格检查 TSX 模块属性 |
| `npm run build` | 输出 `dist/index/circuit.json` 和 `dist/index/schematic.svg` |
| `npm run export` | 更新已提交的 `schematic.svg` |
| `npm test` | 类型检查、构建，并验证编译产物的 GPIO、电源、保护地及输出连接 |

修改接线后执行 `npm test` 和 `npm run export`，把源码与 SVG 一起提交。自动测试验证描述中的网络连接，不替代实际板卡的电气与运行验证。

`tscircuit-jsx.d.ts` 直接复用上游 `@tscircuit/props` 的属性类型，避免聚合类型入口连带检查路由器包的第三方 TypeScript 源码。
