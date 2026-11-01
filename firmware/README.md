# 固件构建

小智保持完整 ESP-IDF 工程，PAO 源码作为外部组件编译成静态库并链接进去。
板型、组件、构建脚本和配置均在 `firmware/` 下维护。上游源码、缓存和构建
产物均放在仓库根目录 Git 忽略的 `tmp/` 下，不提交上游源码。ESP-IDF 及工具链
由用户通过 EIM 安装和管理。

当前板型为 `pao`：ESP32-S3、16 MB Flash、八线 PSRAM，接入 I2S 麦克风、
I2S 功放、BOOT 按键、状态灯、MX1508 双路电机驱动、单路继电器发射控制模块、SSD1306 128×64 OLED 和 3.3V 版 HC-SR04 超声波模块。
GPIO 按硬件接线图配置，详见[板型与接线](boards/pao/README.md)。
板级初始化创建左右电机、两轮底盘和电磁发射器，上电保持停止与断开；
板型通过 MCP 工具和局域网遥控页提供运动与发射控制。
默认 OTA 网关指向灵矽，实机设备绑定及语音连接仍需板上验证；
模拟器单独维护在仓库根目录的 `simulator/`，使用方法见[模拟器说明](../simulator/README.md)。

## 环境

需要 Git、Python 3.10+ 和 [Task](https://taskfile.dev/installation/)。
按照[乐鑫官方安装指南](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32s3/get-started/linux-setup.html)
安装 ESP-IDF 安装管理器（EIM），然后安装并选择 ESP32-S3 开发环境：

```sh
eim install -i v6.0.1 -t esp32s3
eim select
```

运行 `eim select` 时，从列表中选择已安装的 6.0.1 环境。
SDK 和工具链的安装目录由 EIM 管理，不要求放在本仓库内。
默认 base 的最低要求为 ESP-IDF v6.0.1；选择其他版本时需确认与所选小智版本兼容。
可通过 `eim list` 查看已安装的版本，通过 `eim select` 切换。

在仓库根目录运行：

```sh
task firmware:build
```

根 Taskfile 通过 `includes` 引用 `firmware/Taskfile.yaml`，并将任务工作目录设为
`firmware/`。也可以进入 `firmware/` 后直接执行 `task build`。

构建脚本直接使用已激活的 ESP-IDF 环境（`IDF_PATH` 已设置且 `idf.py` 可用）；
否则通过 `eim run` 在 EIM 当前选中的环境中运行。未找到 EIM 时会显示安装指引并退出，
不会自动安装 SDK 或修改系统配置。若 EIM 尚未安装或选择 IDF 版本，先完成上述安装和选择步骤。

构建时自动准备小智源码、接入本地板型和外部组件、生成 IDE 索引并编译固件。
首次需要联网下载小智源码和组件，耗时取决于网络。

构建脚本默认启用 `ccache`，环境中需要已安装该工具。缓存默认保存在 `tmp/ccache/`，
可通过 `CCACHE_DIR` 指定其他目录，也可以临时关闭缓存：

```sh
IDF_CCACHE_ENABLE=0 task firmware:build
```

## 准备、配置与编译

```sh
# 分支、Tag 和 commit。
task firmware:build REF=main
task firmware:build REF=v2.5.2
task firmware:build REF=b3ff05c030923ebf44f494ea1cba54752d638803

# 只配置，生成补全与跳转使用的编译数据库。
task firmware:build ACTION=configure

# 只准备小智源码，不需要 SDK；也可以使用 uv run 执行。
python3 firmware/scripts/build.py prepare --ref main
```

每次省略 `REF` 都使用 `firmware/base.json` 的版本，不沿用上次临时选择。
要长期升级默认版本，修改该文件的 `ref`，推荐使用完整 commit SHA。
分支和 Tag 会在每次执行时从远端获取，实际解析的 SHA 写入
`tmp/base-revision.json`。支持指定引用不代表兼容全部历史版本；若接入补丁
无法应用，脚本会停止，需根据所选版本更新 `firmware/integration.patch`。

脚本不会 reset 或清理上游的用户修改；发现额外改动就停止。
`tmp/xiaozhi` 是脚本管理的源码目录，业务代码始终编辑 `firmware/components/pao/`；
板型始终编辑 `firmware/boards/pao/`，构建脚本使用符号链接接入，不复制源码。
不同 base commit 的构建目录隔离在 `tmp/build/<commit>/`，其中包含
`xiaozhi.bin`、`xiaozhi.elf`、`sdkconfig` 和 `flasher_args.json`。
切换构建参数或修改 defaults 后，已有 `sdkconfig` 的值优先；应在对应构建目录
使用 `idf.py menuconfig` 修改，或移走该构建目录后重新配置。

## 电机驱动

`components/pao/include/motor.h` 提供 C++ `Motor` 类，每个实例控制 MX1508 的一路电机。
构造时传入两根不同、支持输出的 GPIO，内部使用 MCPWM 产生 1 kHz PWM；构造后保持停止，
析构时停止并释放 PWM 资源。SDK 初始化或资源申请失败时通过 `ESP_ERROR_CHECK` 终止。

```cpp
#include "motor.h"

Motor right(GPIO_NUM_11, GPIO_NUM_12);
Motor left(GPIO_NUM_13, GPIO_NUM_14);

right.setSpeed(0.5f);   // 正向，50% 占空比
left.setSpeed(-0.5f);   // 反向，50% 占空比
right.setSpeed(0.0f);   // 两根输入均为低电平，滑行停止
left.setSpeed(0.0f);
```

`setSpeed(float speed)` 接受 `[-1, 1]`，绝对值表示占空比，实际转速随电机、供电和负载变化。
正负方向由 GPIO 顺序及电机接线决定。有限越界值限幅，NaN 和无穷值按停止处理；
同一实例的调用串行执行，换向先关闭原方向输出。请从普通任务调用，不支持 ISR。
以上 GPIO 与板级电机配置一致。

真实 PWM 波形和带载效果仍需实机验证。
MCPWM API 见[乐鑫文档](https://docs.espressif.com/projects/esp-idf/en/v6.0.1/esp32s3/api-reference/peripherals/mcpwm.html)。

## 两轮底盘

`components/pao/include/chassis.h` 提供开环两轮底盘 `Chassis`，将前进/后退和原地旋转
指令转换为两个 `Motor` 的输出。将上例中已创建的左右电机传入：

```cpp
#include "chassis.h"

Chassis chassis(left, right);
chassis.forward();           // 前进
chassis.backward();          // 后退
chassis.turnLeft();          // 俯视时逆时针原地旋转
chassis.turnRight();         // 俯视时顺时针原地旋转
chassis.stop();              // 平滑停车
chassis.emergencyStop();     // 立即清零两轮输出
```

四个方向动作使用 `ChassisConfig` 中保存的前进或旋转最大输出。
新运动替换当前运动，反向或切换运动类型时先降至零输出，再向新目标渐变。

底盘的单个后台任务按实际经过时间更新两轮输出。`ChassisConfig` 包含
`ramp_time_ms`（0～3000，默认 1000）、`left_scale` 和 `right_scale`（均为 `[0, 1]`，
默认 1），以及 `move_output` 和 `rotate_output`（均为 `[0.2, 1]`，默认 0.8）。
`min_output` 表示最小有效 PWM 输出，默认 0，须低于前进和旋转最大输出。
渐变时间表示归一化输出从零到满输出所需时间；零表示关闭渐变。
`chassis.setConfig(config)` 可在运行时修改配置，当前运动和计时不因此重置。
两侧比例系数分别乘到目标输出上；修改系数时输出渐变过渡。
非零最小有效输出使各轮从零跳过低占空比区间，再渐变到目标；停车时渐变回阈值后归零。
某轮经比例校正后的最大输出低于阈值时，该轮输出仍受最大值限制，不能保证起转。
板型遥控页会将六个参数保存到 NVS，重启后恢复；`Chassis` 本身不读写存储。

左右电机必须是不同实例，并且都以带动车体前进为正方向；通过 `Motor` 的 GPIO 顺序适配接线。
电机生命周期必须覆盖底盘，同一对电机交由一个底盘统一控制，使用期间通过底盘下发运动指令。
构造和析构时均停止两轮；`stop()` 平滑停车，`emergencyStop()` 立即清零输出。
底盘命令串行执行，请从普通任务调用，不支持 ISR。

该底盘面向无编码器电机，参数控制的是 PWM 占空比渐变，不保证实际加速度、速度或轨迹；
相同输出下两轮也可能跑偏，左右比例需上车调校。

## 电磁发射器

`components/pao/include/launcher.h` 提供 `Launcher`，用一个 GPIO 驱动一块 3.3V 单路继电器模块，
继电器触点短接发射器的发射按钮。模块触发跳帽设在 L 档，低电平吸合。

发射器由硬件常供电并持续充能，PAO 不控制它的通断，因此驱动只有「发射」一个动作：

```cpp
#include "launcher.h"

Launcher launcher(GPIO_NUM_18);

launcher.fire();      // 吸合 300 ms 再释放，等同于按一下发射键
```

`fire()` 保持发射继电器吸合 `kFirePulseMs`（300 ms）后释放，覆盖触点抖动，
足以让发射器识别为一次按下；调用期间独占驱动，其他调用排队等待。
构造和析构时均断开继电器，上电不会误按。

发射器按**整体黑盒**处理，内部升压、储能与放电开关都不在固件侧展开。
放电回路在模块内部，不经过任何继电器触点；继电器触点只承载按钮信号，在毫安级。

**发射器常供电即常武装。** 上电后它一直在充能，充满即保持，软件没有断电手段，
只能靠断开整机电池开关卸能。因此每次 `fire()` 都会真的打出一发（前提是已充满），
是否已经充满由调用方把握；当前没有充电完成反馈，建议实机测出充能时间后再加延时判断。

继电器极性、吸合电压与充能时间需要板上核对；当前逻辑与时序未经实物验证。

## 超声波测距

`components/pao/include/hc_sr04.h` 提供 `HcSr04`，Trig 接 GPIO8，Echo 接 GPIO9。
模块由主控 3V3 供电，必须支持 3.3V 供电及信号电平。
板型已创建驱动实例，初始化后 Trig 保持低电平，按需调用同步测距接口：

```cpp
#include "hc_sr04.h"

HcSr04 sensor(GPIO_NUM_8, GPIO_NUM_9);
float distance_cm = 0;
const esp_err_t error = sensor.readDistanceCm(distance_cm);
if (error == ESP_OK) {
    // distance_cm 为本次测量的厘米值。
}
```

示例用于独立调用；同一组 GPIO 仅由一个驱动实例管理，不要与板型实例重复创建。
驱动输出至少 10µs 的 Trig 脉冲，以 1µs 分辨率通过 RMT 捕获 Echo，按回波时间 / 58 换算厘米。
连续触发自动间隔至少 60ms，同一实例的测量串行执行；接收阶段最多等待约 80ms，
等待期间让出 CPU。只能从普通任务调用，不能用于 ISR。

成功返回 `ESP_OK`，结果范围为 2–400cm；失败时保留传入的距离值，调用方必须检查返回码：

- `ESP_ERR_TIMEOUT`：超时或未收到回波；模块未连接时同样可能返回此错误。
- `ESP_ERR_INVALID_RESPONSE`：回波脉冲异常、接收缓冲区已满或距离超出范围。
- `ESP_ERR_INVALID_STATE`：触发前 Echo 未恢复低电平，或 RMT 状态异常。

构造时检查 GPIO 并申请 RMT 和队列资源，初始化失败通过 `ESP_ERROR_CHECK` 终止；
析构释放资源。板型通过 `self.ultrasonic.get_distance` 向灵矽提供测距和运动状态，
通过 `self.chassis.move_forward` 按前方同一静止反射物的距离变化控制前进，
通过 `self.chassis.move_to_distance` 停在距障碍物的目标距离。后台任务持续测距，
前方不大于可配置的警报触发距离时自动播放报警音，默认阈值为 10cm；参数、停止条件和使用限制见[板型说明](boards/pao/README.md)。
方向遥控本身不自动避障。
实际量程、测距精度及行驶误差仍需实机验证。
时序依据 [HC-SR04-33 数据手册](https://cdn.sparkfun.com/assets/a/8/9/c/a/HC-SR04-33_Datasheet.pdf)，
RMT 接口见[乐鑫文档](https://docs.espressif.com/projects/esp-idf/en/v6.0.1/esp32s3/api-reference/peripherals/rmt.html)。

## CI

GitHub Actions 的 `Firmware` 工作流（`.github/workflows/firmware.yml`）在 PR 或推送到 `main` 时，
仅当 `firmware/**`、根 `Taskfile.yaml` 或工作流自身变更才运行，也可手动触发。
Ubuntu 24.04 runner 使用 ShellCheck 检查 Shell 脚本、检查 Python 脚本语法，
并使用 Cppcheck 对本仓库的 `firmware/components/pao/` 和 `firmware/boards/`
进行 C/C++ 静态分析。

PR 仅运行静态检查。推送到 `main` 或在 `main` 上手动触发时，静态检查通过后，
`Firmware build` 任务使用乐鑫官方
[install-esp-idf-action](https://github.com/espressif/install-esp-idf-action)
通过 EIM v0.20.1 自动安装 ESP-IDF v6.0.1 和工具链，再运行同一构建脚本获取
默认小智版本并编译固件。Action 固定到完整 commit SHA，环境安装与构建总超时为 45 分钟。

SDK、工具链、Python 环境和 EIM 激活配置通过 `actions/cache` 在多次运行间复用。
缓存按 Ubuntu 版本、CPU 架构、Python、ESP-IDF 和 EIM 版本区分；命中时跳过 SDK 安装，
安装 runner 所需系统依赖并重新激活环境。未命中时自动安装，构建成功后保存缓存。

编译通过 ESP-IDF 的 `IDF_CCACHE_ENABLE` 启用 `ccache`，最多保存 1 GB 编译结果。
每次运行可恢复同一系统、架构和 IDF 版本的最近缓存，由 `ccache` 校验编译器、源码、
头文件和编译参数后复用结果；构建日志会输出本轮命中率。

编译成功后，在该次工作流运行页面的 **Artifacts** 中下载 `pao-firmware-<commit SHA>`。
产物包含构建目录中的 `.bin`、`.elf`、`flash_args`、`flasher_args.json`、`sdkconfig`，
以及记录小智源码版本的 `base-revision.json`；保留目录结构，保存期限遵循仓库配置。
板上烧录、语音连接或 GPIO 行为仍需实机验证。

## 接入位置

- `firmware/components/pao/`：业务组件、公开 C 接口及 C++ 电机、底盘、发射器和超声波驱动，不依赖小智私有类。
- `firmware/boards/pao/`：项目板型、引脚、音频 Codec、按键及左右电机、底盘、发射器、超声波和 OLED 初始化，
  调用 `pao_initialize()`。屏幕复用小智 `OledDisplay`，未连接或驱动初始化失败时回退到 `NoDisplay`。
- `firmware/integration.patch`：注册板型的 Kconfig/CMake 选项，让小智主组件依赖 `pao`；
  并让 MultiNet 唤醒词只在 AFE 的 VAD 判定为语音及其后 1 s 内运行，降低待机 CPU 占用。
- `EXTRA_COMPONENT_DIRS`：直接引用本仓库组件，不复制源码。
- `firmware/sdkconfig.defaults`：板型、语言、唤醒词和灵矽 OTA 网关配置。

后续注册 MCP 工具时，在适配层连接小智工具回调与业务组件；真实板型应使用
独立标识及正确的引脚、Flash 和 PSRAM 配置，避免被参考板固件更新覆盖。

## IDE 补全与跳转

打开本 worktree，先运行 `task firmware:build ACTION=configure` 或 `task firmware:build`。
脚本生成并关联真实编译数据库 `tmp/compile_commands.json`，其中包含
外部业务源码路径、SDK 头文件路径、宏及交叉编译器参数。

VS Code/Cursor 可安装推荐的 clangd 扩展，仓库已配置编译数据库及
`xtensa*-elf` 编译器查询权限；也提供 `PAO: configure` 和 `PAO: build`
任务。任务复用已激活的 SDK 环境，或通过 EIM 加载所选环境。其他 clangd 客户端读取 `firmware/.clangd`；若客户端
未配置交叉编译器查询，需添加相同的 `--query-driver` 参数。

手工维护 include 路径不能替代编译数据库。切换 base 后重新执行 `configure`，
IDE 会指向新的构建配置；依赖下载或配置失败时，不能认为索引已准备完成。

Apple clangd 21 对当前工具链 picolibc 的 `pthread.h` 中 `pthread_exit` 的
`[[noreturn]]` 写法有一处属性诊断；这是工具链头文件的兼容问题，当前配置不隐藏
该诊断。固件由 Xtensa GCC 编译，补全和跨目录跳转可以正常使用。
