# 仓库协作指南

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

新增功能必须使用独立分支并创建 PR。PR 标题必须采用 `type(scope): <中文描述>` 格式，`scope` 表示改动模块，例如：

- `feat(voice): 新增语音指令识别`
- `fix(control): 修复小车转向异常`
- `docs(guide): 完善协作指南`

提交保持单次改动聚焦，使用 `git commit -s` 签署提交。

PR 描述说明改动目的和验证结果，并关联已有 issue。
