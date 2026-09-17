# 多 AI 协作操作手册

这份手册面向 Yanfei，用于在同一个本地 Git 项目中协调 Codex、GitHub Copilot 以及未来可能加入的其他 AI。它说明平时如何分工、如何交接、突然中断时如何恢复，以及怎样把这套方法复制到其他项目。

## 1. 当前结论

NewBoy 已经具备一套完整的多 AI 协作骨架：

- `AGENTS.md`：所有 AI 都必须遵守的长期规则与授权边界。
- `HANDOFF.md`：项目当前整体状态和下一步。
- `TASKS.md`：任务所有权、状态、文件范围和依赖。
- `docs/handoffs/`：每个任务的实施证据、验证结果和遗留风险。
- `docs/decisions/`：已经确定、以后不应反复推翻的架构决策。
- `.github/copilot-instructions.md`：Copilot 进入仓库时的固定入口。
- `.github/workflows/verify.yml`：由 CI 独立验证构建结果。

其他 workspace 中也存在一些 `AGENTS.md` 或 `HANDOFF.md`，但目前只有 NewBoy 同时具备上述完整闭环。存在一两份交接文件，不等于已经建立完整的多 AI 协作系统。

## 2. 推荐角色

默认使用以下分工：

| 角色 | 默认负责人 | 职责 |
|---|---|---|
| Integration Owner | Yanfei | 确认事实、处理争议、批准提交、push、部署和外部操作 |
| Implementer | Codex | 调查、实现、测试、记录任务级交接 |
| Reviewer | Copilot | 独立审查完整 diff，不重复实现同一方案 |
| Automated verifier | GitHub Actions | 在固定 Node/OS 环境重新执行类型检查、构建和容器检查 |

角色可以互换。例如 Codex 中断后，Copilot 可以成为 Implementer；恢复后 Codex则可以担任 Reviewer。关键不是 AI 的名字，而是同一个任务在同一时刻只能有一个实现负责人。

## 3. 哪份资料最可信

正常工作时：

1. 原始证据和用户明确确认的事实。
2. 当前文件内容与 Git diff。
3. 实际测试、构建和运行结果。
4. `TASKS.md`。
5. `docs/handoffs/<TASK-ID>.md`。
6. `HANDOFF.md`。

发生中断时，文档可能来不及更新，因此恢复判断顺序应调整为：

1. 当前文件内容、`git status` 和完整 diff。
2. 能重新执行的验证结果。
3. 任务级 handoff。
4. `TASKS.md`。
5. 根 `HANDOFF.md`。

文档写着“完成”但构建失败，不能算完成；文档还没更新但 diff 中存在可验证的完整实现，也不能直接删除。

## 4. 文件职责

### `AGENTS.md`

只保存长期稳定的规则，例如：

- 哪些目录属于什么系统。
- 哪些文件是共享或冻结文件。
- 禁止伪造数据、自动 push、自动部署或代表用户联系第三方。
- 提交格式、注释语言和验证标准。

不要把临时进度写进这里。

### `HANDOFF.md`

这是项目的总览，不是工作日志。适合记录：

- 当前基准 commit。
- 已稳定完成的能力。
- 当前阶段、下一步和已知阻塞。
- 长期重要限制。

只有 Integration Owner 或明确授权的主任务负责人更新它。并行分支不要同时修改根 handoff。

### `TASKS.md`

每项工程任务至少要写清：

- ID，例如 `NB-006`。
- Task。
- Owner。
- Status。
- File scope。
- Base commit。
- 前置依赖。

推荐状态：

- `ready`：可以认领。
- `active`：正在实现。
- `review`：实现完成，等待独立审查。
- `blocked`：存在明确外部阻塞。
- `done`：已集成且验证通过。

### `docs/handoffs/<TASK-ID>.md`

这是最重要的任务级记录。建议边做边更新，而不是结束时一次性补写。

```markdown
# NB-006 Handoff

- Owner: Codex
- Base commit: abc1234
- Status: active
- File scope: frontend deployment only

## Goal

## Changed

## Verification

## Remaining work

## Risks

## Reviewer notes
```

### `docs/decisions/`

用 ADR 记录已经确认的长期选择，例如为什么选择某种 i18n 结构。它回答“为什么这样做”，不记录每日进度。

## 5. 标准任务流程

### 第一步：创建或认领任务

先在 `TASKS.md` 确认：

- 没有其他 AI 正在修改相同文件。
- Base commit 与当前 `HEAD` 一致。
- 文件范围足够具体。
- 所需事实和授权已经具备。

发送给实现 AI：

> 请先阅读 `AGENTS.md`、`HANDOFF.md`、`TASKS.md`、最近的目录级 `AGENTS.md`，以及任务对应的 `docs/handoffs/<ID>.md`。先复述任务目标、文件范围、基准 commit、禁止操作和验证计划，再开始实现。

### 第二步：实现与持续记录

实现 AI 应当：

1. 先做只读调查。
2. 说明共享文件的影响面。
3. 小步修改。
4. 每完成一个可验证阶段，就把结果补入任务 handoff。
5. 保存准确的验证命令与结果。
6. 不自动 commit、push 或部署。

任务较长时，拆成 `NB-006A`、`NB-006B`，或至少在同一 handoff 中维护阶段清单。不要让五小时的工作只在聊天上下文里存在。

### 第三步：交给独立 Reviewer

发送给审查 AI：

> 请按 `docs/handoffs/<ID>.md` 审查当前工作区完整 diff，包括 tracked 和 untracked 文件。只做审查，不修改代码。按严重度输出 findings，并提供文件路径、行号、影响、证据和建议修复方式。不要只相信 handoff 的完成声明，请用实际 diff 和验证结果核对。

Reviewer 应优先报告真实缺陷，不必复述所有正常内容。没有 findings 时也要明确说明仍未覆盖的验证范围。

### 第四步：返回实现 AI 修复

把完整审查结果交回实现 AI：

> 请逐项验证这份审查。只修复确认属实的问题；对误报说明理由。修复后重新运行相关验证，更新任务 handoff，并保持任务为 `review`，直到复审通过。

### 第五步：Yanfei 集成

只有 Yanfei 明确授权后才可以：

1. 按逻辑拆分 Conventional Commits。
2. push 到远端。
3. 创建或合并 PR。
4. 创建云资源、填写密钥、产生费用或部署。

提交前应运行：

```bash
git status --short
git diff --check
git diff --stat
git log --oneline -10
```

## 6. Codex 中途达到额度时怎么办

### 已知事实

- 已经写入磁盘的代码通常还在。
- 未执行完的 shell 命令可能失败或留下部分产物。
- 聊天里的计划不等于已经实施。
- `HANDOFF.md`、`TASKS.md` 和任务 handoff 可能滞后。
- 没有 commit 的修改仍然可以由另一个 AI 接管。

### 给 Copilot 的完整恢复指令

> Codex 在任务中途停止。请执行恢复审计，不要假设交接文档是最新的，也不要立即修改代码。
>
> 1. 阅读 `AGENTS.md`、`HANDOFF.md`、`TASKS.md`、最近的目录级 `AGENTS.md` 和对应任务 handoff。
> 2. 运行 `git status --short`，列出 tracked、untracked 和可能的生成文件。
> 3. 查看相对当前 `HEAD` 的完整 diff，并单独读取未跟踪文件。
> 4. 检查是否有仍在运行的开发服务器、构建或测试进程。
> 5. 将文档声明与实际代码、diff 和验证结果比较。
> 6. 把现场分成“已完成并验证”“已实现但未验证”“部分实现”“未开始”“来源不明”。
> 7. 先向我报告恢复结果，不要 commit、push、部署、删除或覆盖未知改动。
>
> 如果我确认继续，请在 `TASKS.md` 中把 Owner 改为 Copilot，并创建或更新 `docs/handoffs/<ID>-recovery.md`，记录接手时的 HEAD、工作区状态和重新执行的验证。

### 恢复记录模板

```markdown
# NB-006 Recovery

- Previous owner: Codex
- New owner: Copilot
- HEAD at takeover:
- Working tree: dirty
- Documentation may be stale: yes

## Completed and verified

## Implemented but unverified

## Partial work

## Unknown-origin changes

## Verification rerun

## Remaining work

## Restrictions

- No commit
- No push
- No deployment
```

## 7. Copilot 中途停止时怎么办

步骤完全相同，把 Codex 和 Copilot 的名字互换。不要因为 Codex 是默认 Implementer 就跳过恢复审计。

给 Codex 的短指令：

> Copilot 中途停止。请按 `AGENTS.md` 执行恢复审计，以 Git 工作区和重新验证的结果为准，不假设 handoff 最新。先报告现场，再请求接手任务；不要覆盖未知修改，也不要 commit、push 或部署。

## 8. 两个 AI 可以同时工作吗

可以，但必须满足全部条件：

- 使用不同 branch 或 Git worktree。
- 文件范围不重叠。
- 每项任务有独立 ID 和 Owner。
- 不同时修改 `HANDOFF.md`。
- 共享文件只由一个任务负责。
- 合并顺序提前确定。

不适合并行的情况：

- 两个 AI 都要修改同一个核心组件。
- 第二项任务依赖第一项尚未确定的接口。
- 工作区已有来源不明的修改。
- 需要共同修改数据库模型或环境变量入口。

在不确定时，顺序工作比并行更安全。

## 9. 哪些操作必须由 Yanfei 控制

无论哪个 AI 实现，都不能自行扩大权限。以下操作必须由 Yanfei 明确授权：

- 创建 commit。
- push。
- 合并 PR。
- 部署 staging 或 production。
- 创建外部账号、数据库、API key 或 OAuth 凭据。
- 选择付费套餐或产生费用。
- 修改云端权限。
- 发送消息、联系第三方或提交申请。
- 发布包含个人信息或未经确认事实的内容。

“完成这个项目”不自动等于授权上述外部操作。

## 10. 把这套架构复制到其他项目

### 最小版

适合个人小项目，添加：

```text
project/
├── AGENTS.md
├── HANDOFF.md
├── TASKS.md
├── docs/
│   ├── handoffs/
│   │   └── README.md
│   └── decisions/
└── .github/
    └── copilot-instructions.md
```

### 完整版

再补充：

- 项目专属目录级 `AGENTS.md`。
- CI 验证 workflow。
- 架构文档。
- 部署 runbook。
- PR 模板和 CODEOWNERS（多人协作时）。

### 初始化顺序

1. 写 `AGENTS.md`：目录、事实源、安全边界、禁止操作、提交和验证规则。
2. 写 `HANDOFF.md`：只描述当前真实状态，不复制历史聊天。
3. 写 `TASKS.md`：从第一个任务开始登记 Owner 与文件范围。
4. 创建 `docs/handoffs/README.md` 和 `docs/decisions/`。
5. 为 Copilot 添加入口指令，让它读取相同规则。
6. 添加与技术栈匹配的 CI。
7. 让第二个 AI 做一次“空任务接手演练”，确认它能正确读取规则。

### 不建议只使用一个全局 HANDOFF

每个项目都应保留自己的 `AGENTS.md`、`HANDOFF.md` 和 `TASKS.md`，原因是：

- 技术栈和危险操作不同。
- 不同项目的事实源不同。
- AI 通常优先发现当前仓库内的指令。
- 一个全局 handoff 很快会变成多个项目的混合日志。

可以另建一份 workspace 级索引，列出各项目路径、状态和负责人；但它只负责导航，不能取代项目内规则。

## 11. 新项目可复制的入口指令

### `AGENTS.md` 核心内容

```markdown
# Project Agent Instructions

## Required reading
1. Read `HANDOFF.md`.
2. Read `TASKS.md`.
3. Read the nearest directory-level `AGENTS.md`.
4. Inspect `git status --short` before editing.

## Boundaries
- Do not fabricate facts or data.
- Do not commit secrets or local environment files.
- Do not commit, push, deploy or contact third parties without explicit approval.
- Preserve unrelated user changes.

## Collaboration
- One implementation owner per active task.
- Record file scope and base commit.
- Review the full diff before handoff.
- Use task handoffs under `docs/handoffs/`.
```

### `.github/copilot-instructions.md` 核心内容

```markdown
Read and follow `AGENTS.md`, `HANDOFF.md`, `TASKS.md` and the nearest directory-level `AGENTS.md` before editing.

Confirm task ownership and file scope. Treat Git diff and verification output as evidence. Do not commit, push, deploy, send messages or expose secrets without explicit approval.
```

这些模板只是起点。必须补充项目特有的事实源、共享文件、冻结文件、测试命令和部署边界。

## 12. Yanfei 的日常速查

### 开始新任务

> 先读项目规则并检查 `TASKS.md`。为这个需求建立任务 ID、Owner、文件范围和 base commit，复述后再开始。

### 交给第二个 AI 审查

> 只审查当前任务的完整 diff，包括未跟踪文件；不要修改。按严重度报告文件、行号、影响和修复建议。

### AI 突然中断

> 执行恢复审计，以 Git 工作区和重新验证结果为准，不假设 handoff 最新。先报告现场，不要覆盖、删除、commit、push 或部署。

### 准备提交

> 复核完整 diff、验证结果、敏感信息和文件范围。先给出建议的 Conventional Commits 拆分，不要执行，等我批准。

### 准备部署

> 先列出将创建或修改的外部资源、费用、密钥、域名、数据迁移和回滚方案。在真正产生外部影响前停下来让我确认。

## 13. 判断这套流程是否健康

每隔一段时间检查：

- `TASKS.md` 是否存在长期无人负责的 `active` 任务。
- handoff 是否记录了实际命令，而不只是“测试通过”。
- `HANDOFF.md` 是否仍是总览，而不是流水账。
- 决策是否进入 ADR，而不是只留在聊天中。
- CI 是否对应当前技术栈。
- 新 AI 是否能在不查看旧聊天的情况下恢复工作。
- 是否出现两个 AI 同时修改相同文件。
- 是否有未提交修改长期堆积，导致任务边界无法区分。

如果新 AI 能仅依靠仓库文件、Git 状态和验证命令准确说出“现在做到哪里、谁负责、下一步是什么、哪些事不能做”，这套协作系统就是有效的。
