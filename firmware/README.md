# 固件构建

小智保持完整 ESP-IDF 工程，PAO 源码作为外部组件编译成静态库并链接进去。
板型、组件、构建脚本和配置均在 `firmware/` 下维护。上游源码、缓存和构建
产物均放在仓库根目录 Git 忽略的 `tmp/` 下，不提交上游源码。ESP-IDF 及工具链
由用户通过 EIM 安装和管理。

当前板型为 `pao`：ESP32-S3、16 MB Flash、八线 PSRAM，接入 I2S 麦克风、
I2S 功放、BOOT 按键、状态灯、MX1508 双路电机驱动、两块单路继电器发射模块和 SSD1306 128×64 OLED。
GPIO 按硬件接线图配置，详见[板型与接线](boards/pao/README.md)。
板级初始化创建左右电机、两轮底盘和电磁发射器，上电保持停止与断开；
业务组件初始化仅输出日志，尚未接入上层运动指令或发射指令。
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

`components/pao/include/chassis.h` 提供开环差速底盘 `Chassis`，将前进、转向指令转换为
两个 `Motor` 的输出。将上例中已创建的左右电机传入：

```cpp
#include "chassis.h"

Chassis chassis(left, right);
chassis.drive(0.5f, 0.0f);   // 前进
chassis.drive(-0.5f, 0.0f);  // 后退
chassis.drive(0.0f, 0.5f);   // 原地左转
chassis.drive(0.5f, -0.2f);  // 前进并右转
chassis.drive(0.0f, 0.0f);   // 滑行停止
```

`drive(float forward, float turn)` 的两个参数均为 `[-1, 1]` 的归一化控制量：
`forward` 正负分别表示前进、后退，`turn` 正负分别表示向左、向右旋转。
有限越界参数先限幅，混合后的两轮输出超限时一起按比例缩小；任一参数为 NaN 或无穷值时停止两轮。

左右电机必须是不同实例，并且都以带动车体前进为正方向；通过 `Motor` 的 GPIO 顺序适配接线。
电机生命周期必须覆盖底盘，同一对电机交由一个底盘统一控制，使用期间通过底盘下发运动指令。
构造和析构时均停止两轮，调用 `drive(0, 0)` 滑行停止。
指令保持到下一次 `drive()` 或析构；底盘命令串行执行，请从普通任务调用。

该底盘面向无编码器电机，实际速度和行驶轨迹需上车调校，相同输出也可能跑偏。
板型已创建底盘实例，等待上层运动指令。

## 电磁发射器

`components/pao/include/launcher.h` 提供 `Launcher`，用两个 GPIO 分别驱动一块 3.3V 单路继电器模块：
CH1 把专用 3.3V 送到发射器的供电脚（通电即开始充能），CH2 短接发射器的发射按钮。
两块模块的触发跳帽均设在 L 档，低电平吸合。

```cpp
#include "launcher.h"

Launcher launcher(GPIO_NUM_17, GPIO_NUM_18);

launcher.setCharging(true);   // 给发射器供电，开始充能
launcher.setCharging(false);  // 断开供电
launcher.isCharging();        // 当前供电状态

if (launcher.fire() == ESP_ERR_INVALID_STATE) {
    // 仍在供电充能，已拒绝发射，未产生按键信号
}
```

`fire()` 保持发射继电器吸合 `kFirePulseMs`（100 ms）后释放，覆盖触点抖动，
足以让发射器识别为一次按下；调用期间独占驱动，其他调用排队等待。
供电中调用直接返回 `ESP_ERR_INVALID_STATE`：此时模块仍在充能，触发得到的是未充满的一发，
且模块在充能过程中收到按键信号的行为未定义。构造、析构和 `safeOff()` 均断开两路，上电不会误动作。

发射器按**整体黑盒**处理，内部升压、储能与放电开关都不在固件侧展开。放电回路在模块内部，
不经过任何继电器触点；CH1 触点承载的是发射器的工作电流（百毫安级），远低于继电器 10 A 的额定值。

**必须实测确认断电后的储能是否保持。** 当前时序默认「先断开供电、再发射」；
如果模块失去供电就泄放储能，这一发就会打空，需要改为保持供电发射后再断电。
继电器极性、吸合电压、充能时间和放电波形同样需要板上核对；当前逻辑与时序未经实物验证。

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

- `firmware/components/pao/`：业务组件、公开 C 接口及 C++ 电机、底盘和发射器驱动，不依赖小智私有类。
- `firmware/boards/pao/`：项目板型、引脚、音频 Codec、按键及左右电机、底盘、发射器和 OLED 初始化，
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
