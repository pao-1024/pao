# PAO 模块接线图

使用 [tscircuit](https://tscircuit.com/) 的 TSX 描述供电、ESP32-S3、MX1508 电机驱动、INMP441 麦克风、MAX98357 功放、扬声器和 SSD1306 OLED 的连接。

包含无弹丸的双继电器低压 LED 教学演示，两路触点各自切换一盏指示灯。

这是**模块之间的接线参考**，尚未实物验证。ESP32-S3 保留官方 44 个物理引脚；其他本地接口中的 `pin1` 等是符号索引。接线按 GPIO 名称和模块丝印确认。本目录仅用于模块接线，未验证 PCB 封装、机械尺寸或模块内部电路，不生成可生产的 PCB。

![由 TSX 生成的原理图](schematic.svg)

## 模块与供电

| 模块                  | 接线说明                                                            |
| --------------------- | ------------------------------------------------------------------- |
| 1S 锂电池             | 电池正负极接充电保护板 B+/B−                                        |
| 1S 充电保护板         | 采用已有 TP4056 保护板接口参考；自带 USB 充电口，负载使用 OUT+/OUT− |
| 三脚开关              | COM 与 ON 串联在保护板 OUT+ 和升压输入之间，另一脚不接              |
| 5V 升压板             | 采用已有 MT3608 四端子接口参考；输出设为 5V，给主控与电机驱动供电   |
| ESP32-S3 开发板       | 44 针 DevKitC 开发板，板载稳压输出 3V3                              |
| MX1508 电机驱动小红板 | 电源、IN1–IN4、左右两路电机输出                                     |
| INMP441 麦克风        | 3V3，I2S 输入                                                       |
| MAX98357 功放及扬声器 | VIN 接 3V3，I2S 输出至差分扬声器端子                                |
| SSD1306 I2C OLED      | VCC 接 3V3；目标分辨率为 128×64，尺寸与分辨率以实物为准             |
| 双继电器演示板        | 5V 供电，VIO 选择 3.3V，CH1/CH2 低电平吸合；常开触点只接指示灯      |
| 两路演示 LED          | 每路串联独立 1kΩ 电阻，使用 5V 供电                                 |

MX1508 的 IN1/IN2 控制右电机，IN3/IN4 控制左电机，电源接升压板的 5V 输出。充电板与升压板的实际芯片型号尚未确认，这里采用同类模块的接口作为参考。

## 元件来源

| 元件                       | 定义来源                              |
| -------------------------- | ------------------------------------- |
| 电池、SPDT 开关、扬声器    | tscircuit 内置元件                    |
| ESP32-S3 开发板            | 乐鑫官方 44 针 KiCad 符号             |
| SSD1306 OLED               | `@tscircuit/header-modules`           |
| 左右电机                   | 内置两针端子                          |
| 充电保护、升压模块         | Fritzing / KiCad 板级接口             |
| INMP441、MAX98357A、MX1508 | 本地模块接口                          |
| 双继电器板                 | Seengreat 2-CH Relay HAT 外部端子接口 |
| 演示 LED、限流电阻         | tscircuit 内置元件                    |

外部定义的来源与许可见 [vendor/README.md](vendor/README.md)。

## 源码组织

- `index.tsx`：组合整张图纸。
- `sections/`：供电、主控、麦克风、音频输出、屏幕、电机及继电器演示功能区；GPIO 分配集中在 `Controller.tsx`。
- `components/`：器件接口与符号适配。
- `nets.ts`：共享网络名称与选择器。
- `vendor/`：外部符号及来源说明。

## 信号连接

下表可作为固件的 GPIO 配置依据。

| 模块       | 信号           | ESP32-S3 GPIO | DevKitC-1 排针位置 |
| ---------- | -------------- | ------------- | ------------------ |
| INMP441    | WS             | 4             | J1-4               |
| INMP441    | SCK / BCLK     | 5             | J1-5               |
| INMP441    | SD，麦克风输出 | 6             | J1-6               |
| MAX98357   | DIN，功放输入  | 7             | J1-7               |
| MAX98357   | BCLK           | 15            | J1-8               |
| MAX98357   | LRC / LRCLK    | 16            | J1-9               |
| MX1508     | IN1，右轮      | 11            | J1-17              |
| MX1508     | IN2，右轮      | 12            | J1-18              |
| MX1508     | IN3，左轮      | 13            | J1-19              |
| MX1508     | IN4，左轮      | 14            | J1-20              |
| OLED       | SDA            | 41            | J3-7               |
| OLED       | SCL            | 42            | J3-6               |
| 继电器演示 | CH1            | 17            | J1-10              |
| 继电器演示 | CH2            | 18            | J1-11              |

电源排针：5V 为 J1-21，3V3 为 J1-1/J1-2，GND 可用 J1-22 或 J3-1/J3-21/J3-22。位置依据[乐鑫 DevKitC-1 引脚表](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html#header-block)；手中开发板的型号、方向和丝印仍需一致。

未接入 GPIO39、40、0 的外接按钮。GPIO41/42 用于 OLED 后会占用对应的外部 JTAG 引脚；USB GPIO19/20 保留。

## 双继电器指示灯演示

接口参考 [Seengreat 2-CH Relay HAT](https://seengreat.com/wiki/107/)，
供电接系统 5V/GND，将板上 VIO 开关设为 **3.3V**。
根据厂家[原理图](https://seengreat.com/upload/file/107/2-CH%2BRelay%2BHAT.pdf)，
CH1/CH2 为低电平吸合，输入各有 4.7kΩ 上拉到 VIO，模块包含线圈驱动及续流二极管。
GPIO 只接控制输入，线圈电流由 5V 支路提供。

每路接线为 `5V → COM → NO → 1kΩ 电阻 → LED 阳极 → LED 阴极 → GND`，
NC 悬空。图纸不模拟继电器内部触点切换，COM 与 NO 是独立网络。
两路均为低压指示灯负载，仅用于观察触点通断。

高电平关闭、低电平点亮对应 LED；上电和复位期间依靠模块输入上拉保持关闭，
固件初始化后保持两路高电平，等待显式开关调用。GPIO17/18 与固件板型约定一致。
此接口以指定模块为参考，其他继电器板须重新核对触发极性、输入电平、上拉和端子丝印。
确认现有电池、保护板和升压板具有两路继电器线圈同时吸合时的电流余量。
原理图及实际吸合、复位行为尚未实物验证。

## 电源与固定连接

```text
1S 电池 B+/B− → 充电保护板
保护板 OUT+ → 开关 COM/ON → 升压板 VIN+
保护板 OUT− → 升压板 VIN−/VOUT− → 系统 GND
升压板 VOUT+（5V）→ ESP32-S3 5V、电机驱动 VCC、继电器演示板 VCC/COM1/COM2
ESP32-S3 3V3 → 麦克风 VDD、功放 VIN/SD、OLED VCC
```

- 电池负极 B− 与系统 GND 分开，负载通过保护板 OUT− 回流，避免绕过保护。开关的实际公共脚须按丝印或通断测量确认；图中的开关符号只表示外部接线，不模拟开关状态。充电口内置于充电板，未另画连接器；未知模块是否有电源路径管理，充电时关闭系统开关。
- 电机供电从升压输出直接分支，电机电流不经过开发板排针或 3V3 稳压器。核对电池、保护板、升压板和驱动板能否承受电机堵转与整机峰值电流。
- 功放使用 **3V3 供电**。实际音量和扬声器负载必须在开发板 3V3 稳压器的电流余量内；模块应有厂家要求的去耦。切换供电方案时同步修改 TSX、测试和接线表。
- 麦克风 L/R 接 GND，选择左声道。确认模块包含 SD 的 100kΩ 下拉和厂家要求的去耦；若引出 CHIPEN 则确认已使能。[INMP441 数据手册](https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf)
- 功放 SD_MODE 接 3V3，GAIN 接 GND，按 MAX98357A 对应左声道及 12dB 增益。扬声器只接 OUT+ 与 OUT−，两端均不接系统 GND。[MAX98357A/B 数据手册](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX98357A-MAX98357B.pdf)
- OLED 按 **SDA/SCL/VCC/GND 丝印**接线。不同模块的四针排列、尺寸和分辨率可能不同，不能按照片的排针次序替代丝印；本版假定模块已包含 I2C 上拉。
- 按[乐鑫供电说明](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html#power-supply-options)，USB、5V 排针、3V3 排针供电方式互斥。下载固件时切换供电，避免同时从外部升压板和 USB 向开发板供电。

## 本地预览与验证

需要 **Task v3、Node.js 24+、pnpm 10.32.1 和 [Bun 1.3.10+](https://bun.sh/docs/installation)**。从仓库根目录执行：

```sh
task hardware:setup
cd hardware
task dev
```

浏览器访问命令输出的本地地址（默认 `http://localhost:3020`），查看 Schematic。PCB 已关闭，预览中的 PCB/3D 不代表实际布局。

在 `hardware/` 内使用以下命令；在仓库根目录调用时加 `hardware:` 前缀，例如 `task hardware:test`。

| 命令         | 用途                                                    |
| ------------ | ------------------------------------------------------- |
| `task setup` | 按锁文件安装依赖                                        |
| `task fix`   | ESLint 自动修复，再用 Prettier 统一格式                 |
| `task check` | 检查格式、代码、类型，并构建和检查电路                  |
| `task test`  | 执行完整检查、8 项接线测试，并比较构建 SVG 与已提交图纸 |

构建、预览和导出分别使用 `task build`、`task dev`、`task export`。CI 执行 `task setup` 和 `task test`。

修改接线后执行 `task fix`、`task export` 和 `task test`，把源码与 SVG 一起提交。

检查仅验证模块外部接线，不替代实物验证。布局检查可能在报告问题时仍返回成功，需查看命令输出。
