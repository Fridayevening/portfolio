// 本地 .env 加载(KEY=VALUE,# 行注释):不引依赖,不覆盖已有环境变量。
// 必须是 main.ts 的第一个 import —— 模块级常量读 env 的代码(如 cron
// 表达式)在 import 链上求值,晚了就读不到。

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(__dirname, "..", ".env");

try {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue; // 注释/空行/格式不符
    const val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
} catch {
  // .env 不存在 = 全靠真实环境变量,正常路径
}
