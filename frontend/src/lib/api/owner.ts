"use client";

// 主人之锁的客户端状态(doc 08 §1.3,头传输修订版):口令解锁后 token 存
// localStorage,请求带 x-owner-token 即主人;「访客预览」= 有 token 也不带
// 头,排练访客的世界。模块级外部店 + useSyncExternalStore(mode.ts 模板)——
// 消费方含 dynDefs 渲染闭包,状态必须在 React 外。初始快照恒为锁定态(SSR
// 与客户端首帧一致),挂载后首个订阅者触发同步恢复,钥匙图标随 hydration
// 翻面。副作用(解锁/预览后刷新数据面)不在这里做 —— lib 不反向依赖
// components,由调用方(UI 层)自行 bumpFsRevision。
// 安全口径:token 换来的是"可见性+写权限",威胁模型是普通访客而非定向
// XSS;若未来引入 UGC 渲染面,应升级为 HttpOnly cookie(需同站部署)。

import { useSyncExternalStore } from "react";

const LS_KEY = "nb-owner";

export type OwnerState = {
  token: string | null;
  preview: boolean;
};

export const OWNER_TOKEN_HEADER = "x-owner-token";

const listeners = new Set<() => void>();
let state: OwnerState = { token: null, preview: false };
let restored = false;

function persist(next: OwnerState) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // Private mode / quota: the lock just won't survive a reload.
    }
  }
}

function setState(next: OwnerState) {
  state = next;
  listeners.forEach((l) => l());
}

/** One-shot sync restore on the first subscriber (or first header build) —
 *  deliberately not at module scope, so SSR and the client's first render both
 *  start locked and hydration can't mismatch. */
function ensureRestored() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { token?: unknown; preview?: unknown };
      setState({
        token: typeof v.token === "string" && v.token ? v.token : null,
        preview: v.preview === true,
      });
    }
  } catch {
    // Corrupt cache = stay locked.
  }
}

function commit(next: OwnerState) {
  persist(next);
  setState(next);
}

export const owner = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    ensureRestored();
    return () => listeners.delete(listener);
  },
  get(): OwnerState {
    ensureRestored();
    return state;
  },
  unlock(token: string) {
    commit({ token, preview: false });
  },
  lock() {
    commit({ token: null, preview: false });
  },
  setPreview(preview: boolean) {
    commit({ ...state, preview });
  },
};

/** Headers every owner-capable request should carry: the token when the owner
 *  is unlocked AND not rehearsing the visitor view, nothing otherwise. */
export function ownerHeaders(): Record<string, string> {
  const s = owner.get();
  return s.token && !s.preview ? { [OWNER_TOKEN_HEADER]: s.token } : {};
}

/** 访客视角 = 未解锁或正在预览;UI 的策展层过滤与写权限门都以它为准。 */
export function isVisitorView(): boolean {
  const s = owner.get();
  return !s.token || s.preview;
}

// Frozen SSR snapshot: locked, identical to the client's initial snapshot — no
// hydration mismatch; the real state reveals itself after mount.
const SERVER_SNAPSHOT: OwnerState = { token: null, preview: false };

export function useOwnerState(): OwnerState {
  return useSyncExternalStore(owner.subscribe, owner.get, () => SERVER_SNAPSHOT);
}
