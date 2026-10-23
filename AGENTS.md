# 仓库协作指南

## 项目结构

PAO（PAO Aims Ordnance）是 2026 1024 Hackathon 的语音控制发射小车项目。目前项目说明位于根目录 `README.md`，尚未添加应用源码、测试、资源和构建配置。

实现功能时按职责组织目录，并在 `README.md` 中记录新增目录和组件入口。测试放在被测代码附近或独立测试目录，硬件配置与应用逻辑分开维护。

## Worktree 开发要求

所有开发和文档修改都必须新建独立 worktree，并使用专用分支。禁止直接在主分支 `main` 上修改或提交代码；改动通过 PR 审查后合入主分支。

开始前确认仓库根目录、当前分支及已有 worktree：

```sh
git rev-parse --show-toplevel
git status --short
git worktree list
```

在仓库根目录执行以下命令，基于最新远端主分支创建 worktree；分支名和目录名按任务替换：

```sh
git fetch origin
git worktree add .worktrees/feat-voice-control -b feat/voice-control origin/main
cd .worktrees/feat-voice-control
```

worktree 必须放在仓库根目录的 `.worktrees/` 下，该目录由 `.gitignore` 忽略。修改和提交前核对所在路径及分支，避免在主工作目录操作。

## 构建、测试与本地开发

当前没有配置构建、测试或启动命令，不预设语言、包管理器和工具链。引入可运行组件时，在 `README.md` 中补充环境要求、依赖安装、构建、启动和测试命令，并使用对应工具链的依赖清单。

常用检查：

- `git status --short`：确认改动范围。
- `git diff`：检查已跟踪文件的改动；新增文件需单独阅读。
- `git diff --check`：检查已跟踪文件改动中的空白错误。

## 编码风格与命名

尚未确定语言风格、缩进规则或格式化工具。新增源码时遵循所选语言的标准约定并采用对应格式化工具；修改已有代码时保持周围风格。组件、命令、配置字段和测试使用能表达用途的名称，注释说明约束和设计原因。

## 测试要求

当前没有测试框架和覆盖率门槛。新增非平凡逻辑时补充行为测试，语音与指令处理应覆盖无效输入及异常路径。测试名称表达场景和预期结果，并记录可复跑命令。自动化测试和真实硬件验证分别报告，未执行的硬件检查明确注明。

## 提交与 PR

现有历史仅有 `Initial commit`，尚无稳定提交惯例。后续提交采用 Conventional Commits，例如 `docs: 完善协作指南`，保持单次提交聚焦，使用 `git commit -s` 签署提交。

PR 说明问题、具体改动和验证结果，关联已有 issue；涉及可见行为变化时附截图或演示，并说明复现所需的硬件与配置。commit、push 和创建或更新 PR 分别需要用户明确授权。
