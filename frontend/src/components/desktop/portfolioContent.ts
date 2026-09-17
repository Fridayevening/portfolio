import type { Lang } from "../../lib/i18n/dict";

export type LocalText = { en: string; zh: string };
export type PortfolioSection = { heading: LocalText; paragraphs?: LocalText[]; items?: LocalText[] };
export type PortfolioEntry = {
  id: string;
  kind: "work" | "research";
  title: LocalText;
  subtitle: LocalText;
  metrics?: { value: string; label: LocalText }[];
  sections: PortfolioSection[];
  prototypeUrl?: string;
};

export function local(text: LocalText, lang: Lang): string {
  return text[lang];
}

export const PORTFOLIO_ENTRIES: PortfolioEntry[] = [
  {
    id: "uniubi",
    kind: "work",
    title: { en: "Uniubi connected enterprise portfolio", zh: "宇泛互联企业产品组合" },
    subtitle: {
      en: "Connecting devices, cloud software and mobile workflows across 16 countries.",
      zh: "连接设备、云端软件与移动工作流，覆盖 16 个国家。",
    },
    metrics: [
      { value: "2,409", label: { en: "enterprise organisations", zh: "企业组织" } },
      { value: "29K", label: { en: "portfolio MAU", zh: "产品组合月活" } },
      { value: "16", label: { en: "countries", zh: "覆盖国家" } },
      { value: "6", label: { en: "major releases", zh: "主要版本" } },
    ],
    sections: [
      {
        heading: { en: "From an offline utility to a portfolio", zh: "从离线工具到完整产品组合" },
        paragraphs: [{
          en: "I led product work across Uspace: Ustar for local device operations, UstarCloud for browser-based administration, UstarMobile for employee workflows and UstarAccess for higher-control mobile tasks. My role covered product direction, requirements, backlog decisions and cross-functional delivery with a fixed ten-person team.",
          zh: "我负责 Uspace 产品组合的产品工作：Ustar 支持本地设备管理，UstarCloud 提供浏览器端管理，UstarMobile 服务员工工作流，UstarAccess 支持更高权限的移动任务。我的职责覆盖产品方向、需求、Backlog 决策和固定 10 人团队的跨职能交付。",
        }],
      },
      {
        heading: { en: "Designing for operating constraints", zh: "围绕真实运营约束设计" },
        paragraphs: [{
          en: "Offline support was a core condition for customers with unreliable connectivity. The portfolio separated local device operations, cloud administration and mobile workflows so each role could work in the right environment.",
          zh: "对于网络不稳定的客户，离线能力是基础条件。产品组合将本地设备操作、云端管理和移动工作流拆开，让不同角色在合适的环境中完成任务。",
        }],
      },
      {
        heading: { en: "Compliance and market response", zh: "合规与市场响应" },
        paragraphs: [
          {
            en: "For European expansion, I worked with the team to move raw-face-image storage towards feature-value processing. The architecture change took one month and produced a reusable compliance template for later international product lines.",
            zh: "为进入欧洲市场，我与团队推动原始人脸图像存储转向特征值处理，在一个月内完成架构调整，并形成供后续国际产品线复用的合规模板。",
          },
          {
            en: "During COVID, I built the business case for temperature screening and coordinated hardware, software and algorithm teams. The product launched in six months and helped open opportunities in Africa and Latin America.",
            zh: "疫情期间，我提出测温产品商业案例，协调硬件、软件和算法团队，在六个月内完成上市，并帮助拓展非洲和拉丁美洲市场机会。",
          },
        ],
      },
      {
        heading: { en: "Pricing around use", zh: "围绕实际使用定价" },
        paragraphs: [{
          en: "I helped replace flat-fee pricing with a model based on devices, users and feature modules. The change contributed to 15% year-on-year revenue growth.",
          zh: "我参与将统一收费调整为设备数、用户数和功能模块三个维度，为产品线 15% 的年度收入增长作出了贡献。",
        }],
      },
    ],
  },
  {
    id: "uspace-china",
    kind: "work",
    title: { en: "Uspace China market platform", zh: "Uspace 中国市场平台" },
    subtitle: { en: "Localising workflows, not just words.", zh: "本地化工作流，而不只是翻译文字。" },
    sections: [
      {
        heading: { en: "Localisation beyond language", zh: "本地化不只是语言" },
        paragraphs: [{
          en: "The team moved key UstarMobile and UstarAccess workflows into a WeChat Mini Program, including check-in, attendance, access requests, remote opening, meetings, notifications, directory access and account controls. GPS and Wi-Fi check-in and WeChat-oriented authentication matched how Chinese employees already worked.",
          zh: "团队把 UstarMobile 和 UstarAccess 的关键工作流迁移到微信小程序，包括打卡、考勤、门禁权限申请、远程开门、会议、通知、通讯录和账户管理，并采用适合中国用户的 GPS、Wi-Fi 打卡与微信认证方式。",
        }],
      },
      {
        heading: { en: "Henan smart campus", zh: "河南智慧校园" },
        paragraphs: [{
          en: "I coordinated the education bureau, schools, hardware vendors, software integrators, telecom operators and Uniubi's internal team. The core Henan Yuzi project was delivered on time in three months, and the delivery model was later reused in other regions.",
          zh: "我协调教育局、学校、硬件供应商、软件集成商、运营商和宇泛内部团队，在三个月内按时完成河南豫资项目的核心交付，相关模式后来复用到其他地区。",
        }],
      },
      {
        heading: { en: "Custom work into product", zh: "从定制项目到标准产品" },
        paragraphs: [{
          en: "The XIZI Elevator project created an elevator-control capability that later entered the standard Uspace product.",
          zh: "西子电梯项目形成的电梯控制能力后来进入了 Uspace 标准产品。",
        }],
      },
    ],
  },
  {
    id: "operations",
    kind: "work",
    title: { en: "Operations analytics and supply-chain visibility", zh: "运营分析与供应链可视化" },
    subtitle: { en: "A shared system for hardware delivery and quality decisions.", zh: "用于硬件交付与质量决策的共享系统。" },
    sections: [
      {
        heading: { en: "The problem", zh: "问题" },
        paragraphs: [{
          en: "Catalogue data, supplier information, delivery progress and quality signals were scattered across systems and teams. I proposed and drove an operations-visibility system alongside my core product work.",
          zh: "产品目录、供应商、交付进度和质量信号分散在不同系统与团队中。我在核心产品工作之外主动提出并推动运营可视化系统。",
        }],
      },
      {
        heading: { en: "What the system connected", zh: "系统连接了什么" },
        items: [
          { en: "SKU and catalogue data, suppliers, order and delivery stages.", zh: "SKU 与产品目录、供应商、订单和交付阶段。" },
          { en: "Component and supplier defect-rate monitoring and material-shortage alerts.", zh: "部件与供应商缺陷率监控，以及物料短缺预警。" },
          { en: "Tableau dashboards linking hardware quality with software usage or support data.", zh: "通过 Tableau 看板关联硬件质量、软件使用和客服数据。" },
        ],
      },
      {
        heading: { en: "Outcome", zh: "结果" },
        paragraphs: [{
          en: "Product and operations teams gained a shared way to examine delivery and quality risks, while supplier discussions could refer to observed trends rather than scattered anecdotes.",
          zh: "产品和运营团队获得了共同分析交付与质量风险的方式，供应商沟通也可以基于观察到的趋势，而不是分散的经验判断。",
        }],
      },
    ],
  },
  {
    id: "kreai",
    kind: "work",
    title: { en: "KreAI creator business platform", zh: "KreAI 创作者商务平台" },
    subtitle: { en: "Learning where AI negotiation automation should stop.", zh: "找到 AI 谈判自动化应该停止的位置。" },
    metrics: [
      { value: "6", label: { en: "versions in 6 months", zh: "6 个月内的版本" } },
      { value: "7", label: { en: "team members", zh: "团队成员" } },
      { value: "5", label: { en: "workflow stages", zh: "工作流阶段" } },
      { value: "10", label: { en: "comparison customers", zh: "比较样本客户" } },
    ],
    sections: [
      {
        heading: { en: "The product", zh: "产品" },
        paragraphs: [{
          en: "As the sole product lead in a seven-person team, I turned an early idea into six versions in six months. KreAI connected to creator mailboxes and organised brand collaboration into Initial Outreach, Content Alignment, Price Negotiation, Contract Review and Deal Confirmation.",
          zh: "作为 7 人团队中唯一的产品负责人，我在 6 个月内把早期想法推进为 6 个版本。KreAI 连接创作者邮箱，把品牌合作组织为初次联系、内容对齐、价格谈判、合同审核和确认合作五个阶段。",
        }],
      },
      {
        heading: { en: "Finding the automation boundary", zh: "找到自动化边界" },
        paragraphs: [{
          en: "The MVP automated all five stages. Eight of ten early testers encountered pricing or contract problems, so I changed those stages to AI drafting with human confirmation while keeping lower-risk stages automated.",
          zh: "MVP 最初自动执行全部五个阶段。10 名早期测试用户中有 8 人在价格或合同阶段遇到问题，因此我把这两步改为 AI 起草、人工确认，同时保留低风险阶段的自动化。",
        }],
      },
      {
        heading: { en: "A directional comparison", zh: "方向性比较" },
        paragraphs: [{
          en: "Ten sample customers each used two versions on two weeks of their own mailbox data. Event tracking and manual records showed full-flow completion moving from about 30% to 38%, a relative improvement of about 25%. This small, non-randomised comparison was directional, not causal.",
          zh: "10 个样本客户分别使用两个版本处理各两周自己的邮箱数据。产品埋点与人工记录显示完整流程完成率约从 30% 提升到 38%，相对提升约 25%。这是小样本、非随机的方向性比较，不是因果结论。",
        }],
      },
      {
        heading: { en: "The business lesson", zh: "商业层面的教训" },
        paragraphs: [{
          en: "The product reached a working state but acquisition did not extend beyond approximately 100 seed users from the founder's network. The project ended amid acquisition and fundraising constraints, reinforcing that distribution must be validated alongside the product.",
          zh: "产品达到了可运行状态，但获客没有突破创始人人脉带来的约 100 个种子用户。项目因获客和融资限制而结束，让我认识到分发必须和产品一起验证。",
        }],
      },
    ],
  },
  {
    id: "urgent-lab",
    kind: "research",
    title: { en: "Designing a safer urgent lab alert workflow", zh: "设计更安全的紧急检验结果提醒流程" },
    subtitle: { en: "Healthcare HCI · 2024", zh: "医疗 HCI · 2024" },
    prototypeUrl: "https://www.figma.com/proto/v4MRVKb37qExh5NCod3w1K/HCIPD-Final?node-id=1-4667&p=f&viewport=254%2C108%2C0.14&t=QWooaSMQgBs3iMM6-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1",
    sections: [
      {
        heading: { en: "Research question", zh: "研究问题" },
        paragraphs: [{ en: "How might urgent laboratory results reach the responsible clinical team securely and quickly, with visible acknowledgement and action?", zh: "如何安全、快速地把紧急检验结果传递给负责的临床团队，并明确展示确认与处理状态？" }],
      },
      {
        heading: { en: "Methods", zh: "研究方法" },
        paragraphs: [{ en: "Literature review, a survey of nine healthcare professionals and one expert interview with Dr Grace, followed by workflow mapping, requirements definition and iterative prototyping.", zh: "文献综述、9 名医疗专业人士问卷和 1 场 Dr Grace 专家访谈，随后进行工作流梳理、需求定义与迭代原型设计。" }],
      },
      {
        heading: { en: "Findings", zh: "主要发现" },
        items: [
          { en: "Eight of nine participants identified communication delay as a major problem.", zh: "9 名参与者中有 8 名将沟通延迟视为主要问题。" },
          { en: "A notification alone was insufficient; the workflow needed acknowledgement, ownership, tracking and escalation.", zh: "仅发送通知并不够，工作流还需要确认、责任归属、追踪和升级。" },
        ],
      },
      {
        heading: { en: "Contribution and limits", zh: "个人贡献与局限" },
        paragraphs: [{ en: "I contributed product framing, research synthesis, requirements definition and prototype evaluation within a multidisciplinary HCI team. This was an exploratory prototype study, not a deployed clinical system.", zh: "我在跨学科 HCI 团队中参与产品问题定义、研究归纳、需求定义和原型评估。这是探索性原型研究，不是已经部署的临床系统。" }],
      },
    ],
  },
  {
    id: "lawmate",
    kind: "research",
    title: { en: "Lawmate: accessible legal aid", zh: "Lawmate：更易获得的法律援助" },
    subtitle: { en: "User-centred design · 2023", zh: "以用户为中心的设计 · 2023" },
    prototypeUrl: "https://www.figma.com/proto/XSsl40Z5r68NE9I2dRzxQv/Lawmate-Final-App?type=design&node-id=0-21&t=ibivNRj7rpvdpc4O-1&scaling=min-zoom&page-id=0%3A1&starting-point-node-id=0%3A21&mode=design",
    sections: [
      {
        heading: { en: "Research question", zh: "研究问题" },
        paragraphs: [{ en: "How might international residents in Ireland understand legal information while preserving privacy and reaching credible, affordable support?", zh: "如何帮助居住在爱尔兰的国际人士理解法律信息，同时保护隐私并获得可信、可负担的支持？" }],
      },
      {
        heading: { en: "Methods", zh: "研究方法" },
        paragraphs: [{ en: "Survey, target-user research, a Legal Aid Board interview, personas, concept testing and heuristic evaluation. The team also conducted an internal card sort and a two-user comparison of early prototypes.", zh: "问卷、目标用户研究、Legal Aid Board 访谈、用户画像、概念测试和启发式评估。团队还进行了内部卡片分类和两名用户参与的早期原型比较。" }],
      },
      {
        heading: { en: "Design direction", zh: "设计方向" },
        paragraphs: [{ en: "The final direction combined approachable legal resources, anonymous participation and a route to professional consultation, while recognising misinformation, privacy, affordability and availability risks.", zh: "最终方向结合易于理解的法律资源、匿名参与和专业咨询路径，同时正视错误信息、隐私、价格与可获得性风险。" }],
      },
      {
        heading: { en: "Contribution and limits", zh: "个人贡献与局限" },
        paragraphs: [{ en: "I contributed research synthesis, information architecture and product-design collaboration. Lawmate remained an early design direction, not a validated legal service or source of legal advice.", zh: "我参与研究归纳、信息架构和产品设计协作。Lawmate 仍是早期设计方向，不是经过验证的法律服务，也不提供法律建议。" }],
      },
    ],
  },
];

export const WORK_ENTRIES = PORTFOLIO_ENTRIES.filter((entry) => entry.kind === "work");
export const RESEARCH_ENTRIES = PORTFOLIO_ENTRIES.filter((entry) => entry.kind === "research");
