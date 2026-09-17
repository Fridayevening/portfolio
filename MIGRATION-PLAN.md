# Portfolio → Yanfeiportfolio 内容迁移计划（设计稿）

> 状态：设计提案，**尚未实施**。目标：把 `coding-workspace/portfolio` 里已写好的
> Work / Research 内容，无缝整合进 `coding-workspace/Yanfeiportfolio`（NewBoy 复古桌面）。
> 本文只做方案，不动代码。

## 1. 背景与目标

- **源项目** `portfolio/`：Vite + React 的交互式作品集（Desktop → Work / Research / About Me）。
  内容已写好：**4 个 Work 案例 + 2 篇 Research 研究**，默认英文、可切中文。
- **目标项目** `Yanfeiportfolio/`（NewBoy）：Next.js + NestJS + MongoDB 的复古桌面 OS 作品集。
  目前是「工具箱/服务终端」形态，有文章、文件、新闻、行情、图像实验场、便签、文稿等，
  但**没有结构化的作品集案例内容**。
- **目标**：把 portfolio 的 Work/Research 内容搬进 NewBoy 桌面，作为两个「文件夹」呈现，
  内容与交互风格统一，并复用 NewBoy 现有的中英切换。

## 2. 内容盘点

### 2.1 Work（4 个案例，`portfolio/yanfei-portfolio/src/data/workStories.ts`）

| id | 标题 | 备注 |
|----|------|------|
| `workspace-saas` | Uniubi · International Product Line | 有独立内容包 `content/work/uniubi/`（含 evidence-map） |
| `uzhi-space` | U智空间 · China Market Platform | — |
| `ops-analytics` | Operations Analytics & Supply Chain | — |
| `kreai` | KreAI · AI Creator Business Platform | — |

结构：`WorkStory` = 卡片信息 + 指标（metrics）+ 分节（story/products/decisions/outcomes），
段落支持 `<strong>` 加粗。

### 2.2 Research（2 篇，`researchStories.ts`）

| id | 标题 |
|----|------|
| `healthcare-alerting` | Designing a Safer Urgent Lab Alert Workflow |
| `lawmate` | Lawmate: Accessible Legal Aid |

结构：`ResearchStory` = 标题/副题/标签 + 块（heading/paragraph/list）。

### 2.3 About Me / 联系信息

`PROJECT.md` 标注「待补充」：中英文简介、邮箱、LinkedIn、可下载简历。**不在本次迁移范围**，
但迁移方案要预留它的位置（如「About」窗口）。

## 3. 关键约束（必须先确认，再谈方案）

1. **证据门槛（最重要）**：`content/work/uniubi/README.md` 明确 Uniubi 内容包状态是
   `needs-review`，且**网站当前 5,381 / 850K+ / 7,610 三个数字在职业材料里没找到证据**。
   → 迁移必须遵守「内容包审核通过才同步网站」的规矩：`draft` / `needs-review` 的内容
   **不得**直接进网站；已通过审核的才允许。
2. **双语**：portfolio 的语言策略是「默认英文 + 中文切换」，与 NewBoy 的 i18n（`nb-lang`）
   一致。Uniubi 已有 `case-study.en.md` / `.zh.md` 双语草稿；其余内容目前**只有英文**，
   迁移后中文版需补齐（或先用英文占位）。
3. **隐私与准确**：所有数字、客户名、成果必须可公开、可验证；沿用「不杜撰」原则。
4. **风格**：NewBoy 是「复古桌面 OS + 克制的怀旧幽默」，案例内容要匹配它的文案气质
   （简洁、直白、不堆术语），不能照搬简历腔。

## 4. 迁移策略总览

分三层：**内容层（数据）→ 呈现层（UI）→ 语言层（i18n）**。

### 4.1 内容层：数据放在哪

三个候选，推荐 **C（混合）**：

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| A 静态前端 | 把 `workStories.ts`/`researchStories.ts` 拷进 NewBoy 前端当数据源 | 最快，零后端改动 | 内容不可在线编辑；与 NewBoy「文章/文件可编辑」的架构不一致 |
| B 全走 MongoDB | 内容作为 markdown 存进 articles/files，用 Paper 窗口渲染 | 复用现成编辑能力 | 结构化字段（指标/决策/产品卡片）会被拍平成 markdown，丢失结构 |
| C 混合（推荐） | **结构化数据进后端**（新增 `portfolio` 模块或复用 articles），前端用**专用案例窗口**渲染；纯文本段落存 markdown | 结构完整 + 可编辑 + 双语天然（body/bodyZh 或 en/zh 两份） | 需要新建一个案例渲染窗口 + 数据模型 |

结论：NewBoy 已有 articles/files（base36 id、secret 开关、owner 编辑），案例内容本质是
「带结构的文章」。建议**复用 articles 模块的存储与权限，新增一个 `CaseStudy` 渲染窗口**，
把 WorkStory 的分节结构映射成渲染层理解的数据（段落 + 指标网格 + 决策列表）。

### 4.2 呈现层：映射到 NewBoy 桌面

```
NewBoy 桌面（现有）
├── 我的电脑 / 回收站 / 工具箱 / 实验 ……
└── 新增两个图标（可被 Settings 的 hiddenApps 控制，访客视角可隐藏）
    ├── 📁 Work      → 文件夹窗口，列 4 个案例文件
    │     每个文件   → 双击打开「案例窗口」（新组件 CaseWindow，类似 Paper 但带指标/决策渲染）
    └── 📁 Research  → 文件夹窗口，列 2 篇研究
          每篇      → 双击打开「研究窗口」（heading/paragraph/list 的简单阅读视图）
```

具体映射建议：

| portfolio 概念 | NewBoy 呈现 |
|----------------|-------------|
| WorkStory 卡片 | 文件夹里的一个「文件」图标（标题 = cardTitle） |
| WorkStory 详情（story/products/decisions/outcomes） | CaseWindow：标题区 + 指标网格 + 分节（story 段落、products 卡片、decisions 编号列表、outcomes 反思） |
| ResearchStory | 研究窗口：标题/副题/标签 + 块流（heading/paragraph/list） |
| 案例的 evidence-map | **不进 UI**，作为仓库内的审核参考（保留在 portfolio 或迁入 docs） |
| About Me | 预留「About」窗口，待内容补充 |

### 4.3 语言层：复用 NewBoy i18n

- UI 文案走现有 `dict.ts`（`useI18n()`）。
- 内容双语：后端文章存 `body`（默认语言）+ `bodyZh`（或 `en`/`zh` 两份节点），
  前端按 `lang` 选择渲染；参考 Ledger 报纸的 `section/sectionZh` 先例。
- 中文缺失时：按 portfolio 的「默认英文」策略，中文缺失则回退英文（不出现半成品中文）。

## 5. 分阶段实施计划

**Phase 0 — 事实确认（不写代码）**
- [ ] Yanfei 确认 Uniubi 数字与产品范围（`evidence-map.md` 的 5 个待确认项）。
- [ ] 确认 4 个案例 + 2 篇研究里，哪些是「已可公开」、哪些「待审」。
- [ ] 确认语言命名（`EN / 中文`）与默认语言。

**Phase 1 — 数据模型与后端**
- [ ] 设计案例数据结构（含 en/zh 双语文案 + metrics + decisions 等）。
- [ ] 后端：复用 articles 或新增 `portfolio` 模块；建库表/集合 + 种子数据导入脚本
      （只导入 Phase 0 确认「可公开」的内容）。
- [ ] 证据映射：每个案例附 `evidence-map` 的链接/来源说明（内部，不渲染）。

**Phase 2 — 前端呈现**
- [ ] 新增 `Work` / `Research` 两个桌面图标（进 `Desktop.tsx` 的图标表 + `WIN_DEFS`）。
- [ ] 新建 `CaseWindow` 组件（指标网格 + 分节渲染，复用 Window95 窗框）。
- [ ] 新建 `ResearchWindow` 组件（块流阅读视图）。
- [ ] 接 `useI18n`：内容按 `lang` 切换。

**Phase 3 — 双语补齐与打磨**
- [ ] 补齐其余 3 个案例与 2 篇研究的中文版（或先用英文回退）。
- [ ] 移动端/800×600 视口下的可读性验证。
- [ ] 隐私：默认 secret 开关是否对访客隐藏部分案例。

**Phase 4 — About Me（后续）**
- [ ] 中英文简介、邮箱、LinkedIn、简历下载入口，放进「About」窗口。

## 6. 风险与开放问题

1. **证据风险**：Uniubi 数字未验证。若 Phase 0 未确认，迁移时用保守表述或暂时跳过该案例。
2. **内容格式差异**：portfolio 是结构化 TS，NewBoy 是 markdown 文章；需确定结构化字段
   （metrics/decisions）在后端的存储形式（JSON 字段 vs 拍平 markdown）。
3. **工作流归属**：portfolio 的 `content/` 包是「内容审核」的单一事实源；迁移后建议保留
   该流程——先在 `content/` 更新，审核通过后同步 NewBoy，避免两处内容漂移。
4. **重复内容**：NewBoy 已有一个「实验」文件夹和 Paper 文稿；要避免 Work 案例和实验/文稿
   在导航上重复或混淆。
5. **中文文案质量**：其余案例中文版尚未写，需要 Yanfei 确认是否由 AI 起草后人工审校。

## 7. 建议的决策点（需要 Yanfei 拍板）

1. 案例数据放**后端 MongoDB（可编辑）** 还是 **前端静态数据（快）**？→ 推荐后端。
2. 呈现方式：**新 CaseWindow**（结构完整）还是**复用 Paper markdown**（简单）？→ 推荐新窗口。
3. Uniubi 数字未确认前，该案例是否**先不迁移**，或**用保守表述占位**？
4. 默认语言：英文（沿用 portfolio 策略）还是中文？
