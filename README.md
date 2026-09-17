# NewBoy — 个人作品集

以「复古桌面电脑」（Windows 95 风）形式呈现的交互式作品集网站。

- **前端** `frontend/`：Next.js 16 + React 19 + Tailwind 4，模拟复古 OS 桌面（窗口、开始菜单、扫雷、NES、文件系统等）。
- **后端** `server/`：NestJS 12 + MongoDB 原生驱动，提供 `/v1` API；含图像处理 `hotaru` 模块（调用 `server/python/` 的 Python 脚本）。

## 目录结构

```
Yanfeiportfolio/
├── frontend/          # Next.js 前端（端口 3030）
└── server/            # NestJS 后端 + python/ 脚本（端口 3031）
```

## 本地运行

### 前置条件

- Node.js ≥ 24 LTS（推荐）
- MongoDB 运行于 `127.0.0.1:27017`（库名 `newboy`，无鉴权）
- Python 3.14（仅 `hotaru` 图像/视频功能需要）

### 后端

```bash
cd server
npm install
npm run dev          # nest start --watch，监听 http://localhost:3031
# 可选：初始化 Python 环境
npm run python:setup # 建 .venv 并安装 pillow/numpy/av
```

### 前端

```bash
cd frontend
npm install
npm run dev          # next dev，监听 http://localhost:3030
```

浏览器打开 `http://localhost:3030`。

## 环境变量（后端，可选）

`server/.env`（格式 `KEY=VALUE`，`#` 注释）：

```
PORT=3031
MONGODB_URI=mongodb://127.0.0.1:27017
```

未配置时使用上述默认值。

## 注意

- `server/python/` 是冻结副本，`hotaru.py` 的 source of truth 在 `skill-lab/HypeBoyImgTool/hotaru/`，勿单改此副本。
- 提交规范：Conventional Commits（本地 hook 强制），见 `frontend/AGENTS.md`。
