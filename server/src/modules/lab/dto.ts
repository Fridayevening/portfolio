// lab 模块契约:laser-card 是图片实验室的第一个功能,未来新功能在本模块下加自己的
// 路由段与契约。无用户可调参数(材质/灯光是设计定值),故没有请求 DTO;响应形状与
// 前端 newboy/src/lib/api/types.ts 手写对齐。

export type LaserCardJobStatus = "queued" | "processing" | "done" | "failed";

// 渲染管线的五个阶段,进度条按阶段分段线性展示
export type LaserCardStage = "textures" | "front" | "3d" | "alpha" | "glb";

export type LaserCardKind = "front" | "3d" | "alpha" | "glb";

export interface LaserCardJobResponse {
  jobId: string;
  status: LaserCardJobStatus;
  stage: LaserCardStage | null;
  /** 0-100;阶段锚点 + Blender sample 行插值 */
  progress: number | null;
  queuePosition: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LaserCardSubmitResponse {
  jobId: string;
}

export interface LabPingResponse {
  python: string;
  pythonOk: boolean;
  blender: string;
  blenderOk: boolean;
}

export const LASER_CARD_KINDS: readonly LaserCardKind[] = ["front", "3d", "alpha", "glb"];

// laser_scene.py 的落名约定:由输出路径 laser-card.png 派生 -3d/-alpha/.glb,
// 改脚本落名必须同步这里(校验按固定文件名,不猜目录内容)
export const LASER_CARD_FILES: Record<LaserCardKind, { file: string; mime: string }> = {
  front: { file: "laser-card.png", mime: "image/png" },
  "3d": { file: "laser-card-3d.png", mime: "image/png" },
  alpha: { file: "laser-card-alpha.png", mime: "image/png" },
  glb: { file: "laser-card.glb", mime: "model/gltf-binary" },
};
