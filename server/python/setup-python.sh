#!/usr/bin/env bash
# server 私有 venv 引导:repo 根的 .venv 是 hotaru/ 实验场的,server 不依赖它。
# HOTARU_PYTHON 可指定建 venv 用的基础解释器(默认 python3)。
set -euo pipefail
cd "$(dirname "$0")/.."   # -> newboy-server/

"${HOTARU_PYTHON:-python3}" -m venv .venv
.venv/bin/pip install --upgrade pip >/dev/null
.venv/bin/pip install -r python/requirements.txt
.venv/bin/python -c "import numpy, PIL, av; print('hotaru deps ok:', numpy.__version__, PIL.__version__, av.__version__)"

# ffprobe 只是探测(视频旋转元数据),缺失不致命但竖屏视频会横躺
command -v ffprobe >/dev/null && echo "ffprobe: $(command -v ffprobe)" || echo "warning: ffprobe 不在 PATH,竖屏视频旋转元数据将被忽略"
