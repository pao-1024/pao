# 仓库协作指南

## 文档规范

- 文档面向项目使用和维护，描述当前功能、使用方法和维护入口，不记录对话过程、迁移或重构经过、未采用方案的筛选过程。
- README 不堆叠依赖兼容补丁、工具内部机制或重复源码的实现说明；确有维护价值的原因在相关代码附近简要注明。
- 保留必要的来源、许可及影响实际使用的限制，避免重复说明。PR 描述聚焦最终改动和验证结果，不复述开发过程。

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

## 提交与 PR

新增功能必须使用独立分支并创建 PR。PR 标题必须采用 `type(顶层模块/子模块): <中文描述>` 格式；子模块可省略，省略时采用 `type(顶层模块): <中文描述>`。

- `type` 表示改动性质：`feat`（新增功能）、`fix`（修复问题）、`refactor`（重构）、`docs`（文档）、`test`（测试）、`build`（构建与依赖）、`ci`（持续集成）、`chore`（其他维护）。
- 顶层模块使用 `firmware`、`hardware`；仓库公共事项使用 `repo`。
- 子模块使用稳定的模块名，小写英文、连字符分词，优先沿用现有目录或功能区名称，不要求与完整文件路径一致。
- scope 最多两层；涉及同一顶层模块下的多个子模块时，省略子模块，例如 `refactor(hardware): 统一器件接口命名`。
- 固件与硬件联动时使用 `repo`，例如 `fix(repo): 统一电机接线与固件引脚配置`，具体范围在 PR 描述中说明。

示例：

- `feat(firmware/pao): 新增电机控制接口`
- `fix(firmware/boards): 修正板型引脚配置`
- `fix(hardware/power-supply): 修正升压模块接线`
- `refactor(hardware/motor-drive): 简化电机驱动连接`
- `ci(firmware/build): 调整固件构建缓存`
- `docs(repo): 完善仓库协作指南`

提交保持单次改动聚焦，使用 `git commit -s` 签署提交。

PR 描述说明改动目的和验证结果，并关联已有 issue。
