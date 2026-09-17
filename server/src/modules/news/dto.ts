// 新闻契约:与前端 newboy/src/lib/api/types.ts 的 NewsFlash/NewsTodayResponse 对齐。
// 响应无用户输入,不做运行时校验;接口形状即服务端缓存形状。

export interface NewsFlashDto {
  /** 版面:恒为 CRYPTO(订阅面已收缩到纯加密源);字段保留以稳前端契约 */
  section: string;
  /** 电讯的刊发日 UTC "YYYY-MM-DD"(即抓取日) */
  day: string;
  /** AI 产出的英文短标题(全大写新闻标题);原始标题路径为 null,
   *  前端回退"首句当标题"的旧排版 */
  headline: string | null;
  /** AI 产出的中文短标题;英文路径/原始路径为 null。前端默认展示中文,
   *  英文仅随接口返回(当前不展示) */
  headlineZh: string | null;
  /** ticker/资产/主题标签,如 "FED · RATES"、"BTC · SPOT ETF" */
  kicker: string;
  /** 完整快讯正文;AI 路径 = 1-3 句短讯,无 key 路径 = 原始标题(+摘要) */
  text: string;
  /** 中文短讯正文;英文路径/原始路径为 null */
  textZh: string | null;
  /** 编辑部解读(中文,2-4 句):影响、受益/受损方、后续观察点。仅详情
   *  窗口展示,卡片不渲染;原始路径为 null */
  analysis: string | null;
  /** 第一条通讯社来源链接,无则为 null(前端回退门户页) */
  url: string | null;
  /** 来源署名,如 ["CNBC"]、["CoinDesk"] */
  wires: string[];
}

export interface NewsTodayResponse {
  /** 本轮抓取完成时间(ISO) */
  at: string;
  flashes: NewsFlashDto[];
}
