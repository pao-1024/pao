# 固件构建

小智保持完整 ESP-IDF 工程，PAO 源码作为外部组件编译成静态库并链接进去。
板型、组件、构建脚本和配置均在 `firmware/` 下维护。上游源码、缓存和构建
产物均放在仓库根目录 Git 忽略的 `tmp/` 下，不提交上游源码。ESP-IDF 及工具链
由用户通过 EIM 安装和管理。

当前板型为 `pao-minimal`：ESP32-S3、16 MB Flash、八线 PSRAM，只有
I2S 麦克风、I2S 功放、BOOT 按键和状态灯，不需要屏幕。GPIO 暂沿用小智
面包板配置，详见[板型与接线](boards/pao-minimal/README.md)。
业务组件初始化仅输出日志；提供独立电机驱动类，板型尚未接入电机或发射控制。
默认 OTA 网关指向灵矽，
但未验证设备绑定及语音连接。

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
板型始终编辑 `firmware/boards/pao-minimal/`，构建脚本使用符号链接接入，不复制源码。
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
以上 GPIO 对应硬件接线参考，当前板型不会自动创建或启动电机。

主机测试需要 C++17 编译器和 pthread，无需 SDK 或实物：

```sh
task firmware:test
# 或直接运行：bash firmware/tests/motor/run.sh
```

测试替换 GPIO/MCPWM 硬件边界，覆盖方向、停止、占空比、输入边界、双电机独立控制、
并发换向和资源释放；真实 PWM 波形和带载效果仍需实机验证。
MCPWM API 见[乐鑫文档](https://docs.espressif.com/projects/esp-idf/en/v6.0.1/esp32s3/api-reference/peripherals/mcpwm.html)。

## CI

GitHub Actions 的 `Firmware` 工作流（`.github/workflows/firmware.yml`）在 PR 或推送到 `main` 时，
仅当 `firmware/**`、根 `Taskfile.yaml` 或工作流自身变更才运行，也可手动触发。
Ubuntu 24.04 runner 使用 ShellCheck 检查 Shell 脚本、检查 Python 脚本语法，
并使用 Cppcheck 对本仓库的 `firmware/components/pao/` 和 `firmware/boards/pao-minimal/`
进行 C/C++ 静态分析，并使用主机 C++ 编译器运行电机驱动测试。

静态检查通过后，`Firmware build` 任务使用乐鑫官方
[install-esp-idf-action](https://github.com/espressif/install-esp-idf-action)
通过 EIM v0.20.1 自动安装 ESP-IDF v6.0.1 和工具链，再运行同一构建脚本获取
默认小智版本并编译固件。Action 固定到完整 commit SHA，环境安装与构建总超时为 45 分钟。

SDK、工具链、Python 环境和 EIM 激活配置通过 `actions/cache` 在多次运行间复用。
缓存按 Ubuntu 版本、CPU 架构、Python、ESP-IDF 和 EIM 版本区分；命中时跳过 SDK 安装，
安装 runner 所需系统依赖并重新激活环境。未命中时自动安装，构建成功后保存缓存。

编译通过 ESP-IDF 的 `IDF_CCACHE_ENABLE` 启用 `ccache`，最多保存 1 GB 编译结果。
每次运行可恢复同一系统、架构和 IDF 版本的最近缓存，由 `ccache` 校验编译器、源码、
头文件和编译参数后复用结果；构建日志会输出本轮命中率。

CI 不上传构建产物。板上烧录、语音连接或 GPIO 行为仍需实机验证。

## 接入位置

- `firmware/components/pao/`：业务组件、公开 C 接口及 C++ 电机驱动，不依赖小智私有类。
- `firmware/boards/pao-minimal/`：独立板型、引脚、音频 Codec 和按键初始化，调用
  `pao_initialize()`。无屏幕实现复用小智默认的 `NoDisplay`。
- `firmware/integration.patch`：注册板型的 Kconfig/CMake 选项，让小智主组件依赖 `pao`。
- `EXTRA_COMPONENT_DIRS`：直接引用本仓库组件，不复制源码。
- `firmware/sdkconfig.defaults`：板型、语言和灵矽 OTA 网关配置。

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
