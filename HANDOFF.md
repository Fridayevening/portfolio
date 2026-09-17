# NewBoy — Handoff / 交接文档

> 本文档是给后续 AI / 协作者的第一入口。开工前先读完本文 + `frontend/AGENTS.md`。
> 版本快照：2026-09-15（项目已在本地跑通）。

## 1. 项目是什么

代号 **NewBoy** 的个人作品集网站，以「复古桌面电脑（Windows 95 风）」的交互形式呈现。
- 前端：模拟一个可玩的操作系统桌面（窗口、开始菜单、扫雷、NES 模拟器、文件系统、便签、行情窗、图像实验场）。
- 后端：NestJS API（文章、文件、新闻、行情、偏好、主人模式、hotaru 图像/视频处理）。
- Python：`hotaru.py` 等脚本把图片/视频转成复古质感（CRT / miniDV / dreamcore 等预设）。

## 2. 目录结构

```
Yanfeiportfolio/
├── HANDOFF.md          # 本文档
├── README.md           # 面向人的简要说明
├── frontend/           # Next.js 16 前端（:3030）
│   └── src/components/desktop/   # 桌面模拟全部组件
└── server/             # NestJS 12 后端（:3031，/v1 前缀）
    ├── src/modules/    # 9 个业务模块（见 §6）
    ├── python/         # hotaru/laser 脚本（冻结副本）
    └── .venv/          # hotaru 的 Python 环境（python:setup 产物）
```

## 3. 技术栈

| 层 | 技术 | 关键版本 |
|----|------|----------|
| 前端 | Next.js (App Router, Turbopack) / React / Tailwind 4 / three.js / jsnes | Next 16.3.4, React 19.2.8 |
| 后端 | NestJS / MongoDB 原生驱动（非 Mongoose）/ @nestjs/schedule / undici | NestJS 12, mongodb 7.6 |
| 数据库 | MongoDB（库名 `newboy`），无鉴权，本地 `127.0.0.1:27017` | mongod 8.0.32 |
| Python | pillow / numpy / av(PyAV) | Python 3.12（兼容） |
| 包管理 | npm（镜像 npmmirror）、pip（镜像清华 TUNA） | — |

## 4. 环境准备（新机器一次性）

1. **Node 24 LTS**（nvm 默认 `24`；不要用 23，Nest CLI 的 angular-devkit 会崩）。
2. **MongoDB**：本机 `mongod` 跑在 27017（launchd 服务名 `mongodb-community`）。
3. **后端依赖**：`cd server && npm install`。
4. **前端依赖**：`cd frontend && npm install`。
5. **Python 环境**（hotaru 功能需要）：`cd server && npm run python:setup`（建 `.venv`）。
6. **`server/.env`**（不存在时写接口 401 + 行情/新闻拉不到）：
   ```
   OWNER_TOKEN=<≥8位>
   MARKET_PROXY_URL=http://127.0.0.1:7897   # 留空=直连
   NEWS_PROXY_URL=http://127.0.0.1:7897
   ```
7. **网络**：GitHub/PyPI 直连不通，走 Clash Verge（混合端口 7897）。终端代理已在 `~/.zshrc` 自动配置（含 no_proxy 白名单）；pip 已配清华镜像。

## 5. 启动与验证

```bash
# 后端（两个终端分别跑）
cd server && npm run dev        # 或 npm run build && node dist/main.js
cd frontend && npm run dev      # http://localhost:3030

# 健康检查
curl http://127.0.0.1:3031/v1/health
# 关键自检
curl http://127.0.0.1:3031/v1/market/quotes   # 行情（全走 CoinGecko）
curl http://127.0.0.1:3031/v1/news/today      # 新闻（CoinDesk/Cointelegraph/深潮）
curl http://127.0.0.1:3031/v1/hotaru/ping     # Python 环境就绪?
```

## 6. 后端模块职责

| 模块 | 职责 |
|------|------|
| `health` | `GET /v1/health` 探活 |
| `auth` | owner token 解锁（`OWNER_TOKEN`，fail-closed：未配置=全部写接口 401） |
| `articles` | 文章 CRUD + secret 切换 |
| `files` | 虚拟文件系统（回收站/复制/移动/restore） |
| `news` | 三路源并发抓取（2 路 RSS 走代理 + 深潮直连），可选 AI 编选 |
| `market` | 行情引擎：watchlist 全走 CoinGecko，5 分钟轮询，SSE 流 |
| `preferences` | 用户 UI 偏好（DB 持久化） |
| `hotaru` | 编排 Python 子进程做图像/视频复古滤镜 |
| `lab` | 激光卡片（需 Blender，本机未装） |

**约定**：全局 `/v1` 前缀、ValidationPipe 校验、`db.ts` 惰性 MongoClient（base36 id、3s 超时→503）。

## 7. 关键代码约定（必须遵守）

- **提交**：Conventional Commits，本地 hook 强制。格式 `<type>(<scope>): <subject>`，scope 常用 `desktop`/`market`/`hotaru`/`server`。
- **注释**：新注释必须英文、解释 why 不重复 what；不写 TODO/历史；同一文件不混中英。
- **不造假数据**：行情/新闻拉取失败时冻结旧值，绝不编造。

## 8. 踩过的坑（重要）

1. **undici ProxyAgent 冷域名首连 TLS 断开**：经 Clash 代理第一次连某个域偶发 `socket disconnected before TLS`。已在 `market-providers.ts` 的 `fetchJson` 加「3 次带 300/800ms 延迟」的重试（只重试网络错误，429 交给引擎退避）。news 的 `retry3s` 是旧方案（3s 后单次重试），仍可能漏。
2. **hotaru 服务在启动时固定 python 路径**：`.venv` 必须在后端启动前就绪，否则 `pythonOk:false`，要重启后端才会重测。
3. **Node 版本**：23 会崩 Nest CLI；用 24 LTS。
4. **`MARKET_PROXY_URL` 默认空**（news 默认就是 7897），忘记配就直连超时。
5. **pip 直连 PyPI 会被干扰**：已配清华镜像；新 venv 若报 SSL 错先查 `pip config list`。

## 9. 多 AI 协作规则

- **先读本文 + `frontend/AGENTS.md`**，再动手。
- **单一事实源**：`server/python/hotaru.py` 是冻结副本，源在 `skill-lab/HypeBoyImgTool/hotaru/`，勿单改此副本。
- **改代码前先 grep 相关模块**，尊重既有结构（模块边界、纯函数层、DI 约定）。
- **改共享文件**（`db.ts`、`env.ts`、`watchlist.ts`、`market-providers.ts`）前先说明影响面。
- **不要自动 push**；不要自动申请/发消息（本项目是本地作品集，发布动作需本人确认）。
- **翻译/文案**：面向用户的字符串改英文时，注意 i18n 机制（见 i18n 专项文档）。

## 10. 已知待办 / 未完成项

- [x] 网站 i18n（中/英切换）——**已完整完成**，见 §11（前端全部 UI 文案 + 后端全部错误消息 + 行情播报均已双语）。
- [ ] `lab` 激光卡片需要 Blender（未安装）。
- [ ] news 的 `retry3s` 可升级为与 market 一致的带延迟多次重试。
- [ ] 前端 `public/` 含 42MB 媒体资源，仓库/部署时考虑拆分。

## 11. i18n 机制（中英切换）

**架构**：轻量自研方案，不用 next-intl、不改 URL 路由。

- 字典：`frontend/src/lib/i18n/dict.ts`（`zh` 为唯一事实源，`en` 按 `keyof typeof zh` 类型强约束，漏译即编译错误）。
- 上下文：`frontend/src/lib/i18n/LanguageContext.tsx`（`LanguageProvider` + `useI18n()`，返回 `{ lang, setLang, t }`）。
- 语言存储：独立 cookie `nb-lang`（`"zh" | "en"`），SSR 在 `layout.tsx` 读 cookie 传 `initialLang`，客户端 `setLang` 写 cookie，切换即时生效。
- 切换器：设置窗口「语言」标签页（`Settings.tsx`，`tab === "lang"`）。
- 窗口标题：`WinDef` 加 `titleKey?: DictKey`，静态标题走 `t(titleKey)`，动态标题（如 PAPER 运行中改名）仍用 `title` 字符串。
- 行情名称：`syms.ts` 的 `Sym` 加 `nameEn`，`symName(id, lang, fallback)` 按语言取名。

**前端翻译状态**：全部 UI 文案已双语化（桌面图标/窗口标题/右键菜单/开始菜单/任务栏/设置/文件夹视图/记事本/媒体播放器/终端/运行框/系统属性/我的电脑/监视器/邮件/Bazinga/行情窗口与告警，以及所有游戏与创意窗口——Mines、NES、RepairGame、ColaRush、Hotaru、ImgLab、LaserCard3D、Paper、便签、DeskTexts、Fs 等）。英文模式 SSR 0 中文字符；仅开发者可见的 hook 误用 throw 文案为英文。`notes.txt` 默认内容已换成原创占位（不再有歌词版权风险）。

**后端错误消息 i18n**：`server/src/i18n.ts`（AsyncLocalStorage + 字典 + `LocalizedError`）+ `lang.middleware.ts`；`db`/`auth`/`articles`/`files`/`preferences`/`news`/`hotaru`/`lab` 全部错误走 `t(key)`。后台任务（视频/激光渲染、关停取消）在请求作用域外运行时只存 key，`describe()` 读回时用 `translateIfKey()` 按当前请求语言翻译。

**行情播报（SSE）本地化**：`EventSource` 带不了 `x-lang` 头，服务端 `rotate()` 不再生成中文 `msg`，改发结构化字段 `dayPct` + `kind`；前端 `MarketAlerts.tsx` 用 `serverAlertMsg()` 按当前语言拼文案（`market.alertNow/intraday/h24`）。离线镜像引擎（`local-engine.ts`）继续自带 `msg`，二者同走一个 `AlertPayload` 契约。

**新闻内容**：深潮源为中文，`Ledger.tsx` 的 `liveEditions()` 在英文模式过滤掉无 `headline` 且正文含汉字的条目；AI 编选稿自带中英双字段，前端按语言取 `headline/text`（en）或 `headlineZh/textZh/analysis`（zh）。

**续译流程**：grep 文件中的中文字符 → 在 `dict.ts` 加键（zh+en）→ 组件内 `useI18n()` 后用 `t("key")` 替换硬编码字符串。注意模块作用域常量（如 `WIN_DEFS`）不能直接用 hook，用 `titleKey` 模式或把常量搬进组件。
