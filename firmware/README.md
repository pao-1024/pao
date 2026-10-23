# 固件构建

小智保持完整 ESP-IDF 工程，PAO 源码作为外部组件编译成静态库并链接进去。
板型、组件、构建脚本和配置均在 `firmware/` 下维护。上游源码、SDK、缓存和构建
产物均放在仓库根目录 Git 忽略的 `tmp/` 下，不提交上游源码。

当前板型为 `pao-minimal`：ESP32-S3、16 MB Flash、八线 PSRAM，只有
I2S 麦克风、I2S 功放、BOOT 按键和状态灯，不需要屏幕。GPIO 暂沿用小智
面包板配置，详见[板型与接线](boards/pao-minimal/README.md)。
业务组件初始化仅输出日志，没有电机或发射控制逻辑。默认 OTA 网关指向灵矽，
但未验证设备绑定及语音连接。

## 环境

需要 Git、Python 3.10+ 和 [Task](https://taskfile.dev/installation/)。
在仓库根目录运行一个命令：

```sh
task firmware:build
```

根 Taskfile 通过 `includes` 引用 `firmware/Taskfile.yaml`，并将任务工作目录设为
`firmware/`。也可以进入 `firmware/` 后直接执行 `task build`。

首次自动在仓库根目录的 `tmp/esp-idf` 和 `tmp/idf-tools` 安装 ESP-IDF v6.0.1 及工具链，
准备小智源码、接入本地板型和外部组件、生成 IDE 索引并编译固件。
首次需要联网下载 SDK、工具链和组件，耗时取决于网络。
如果已经设置 `IDF_PATH`，则复用该 SDK，并加载它的 `export.sh`；需要兼容
所选小智版本，默认 base 的最低要求为 ESP-IDF v6.0.1。

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

## CI

GitHub Actions 的 `Code checks` 工作流在 PR、推送到 `main` 和手动触发时运行。
Ubuntu 24.04 runner 使用 ShellCheck 检查 Shell 脚本、检查 Python 脚本语法，
并使用 Cppcheck 对本仓库的 `firmware/components/pao/` 和 `firmware/boards/pao-minimal/`
进行 C/C++ 静态分析。

CI 不安装 ESP-IDF，不获取小智源码，不执行固件构建，也不上传产物。
没有 SDK 头文件和完整编译配置的静态检查不能证明固件可编译；需要时在本地运行
`task firmware:build`。板上烧录、语音连接或 GPIO 行为仍需实机验证。

## 接入位置

- `firmware/components/pao/`：业务组件及公开 C 接口，不依赖小智私有类。
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
任务。任务自动加载 SDK 环境。其他 clangd 客户端读取 `firmware/.clangd`；若客户端
未配置交叉编译器查询，需添加相同的 `--query-driver` 参数。

手工维护 include 路径不能替代编译数据库。切换 base 后重新执行 `configure`，
IDE 会指向新的构建配置；依赖下载或配置失败时，不能认为索引已准备完成。

Apple clangd 21 对当前工具链 picolibc 的 `pthread.h` 中 `pthread_exit` 的
`[[noreturn]]` 写法有一处属性诊断；这是工具链头文件的兼容问题，当前配置不隐藏
该诊断。固件由 Xtensa GCC 编译，补全和跨目录跳转可以正常使用。
