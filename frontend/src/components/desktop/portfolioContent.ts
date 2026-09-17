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
      en: "Evolving an offline device utility into connected desktop, cloud and mobile workflows across 16 countries.",
      zh: "把离线设备工具发展为桌面、云端与移动端互联的产品组合，覆盖 16 个国家。",
    },
    metrics: [
      { value: "2,409", label: { en: "enterprise organisations · cumulative portfolio", zh: "企业组织 · 产品组合累计口径" } },
      { value: "29K", label: { en: "monthly active users · full portfolio", zh: "月活用户 · 完整产品组合口径" } },
      { value: "16", label: { en: "countries", zh: "覆盖国家" } },
      { value: "6", label: { en: "major platform releases", zh: "主要平台版本" } },
    ],
    sections: [
      {
        heading: { en: "Context: hardware needed a usable system", zh: "背景：硬件需要一套真正可用的系统" },
        paragraphs: [
          {
            en: "Uspace grew around organisations using recognition devices for personnel, access control and attendance. The challenge was not simply to add more device features. Administrators, employees and managers needed different ways to complete their work across local networks, browsers and phones.",
            zh: "Uspace 服务于使用识别设备进行人员、门禁和考勤管理的组织。真正的挑战不只是继续增加设备功能，而是让管理员、员工和管理者能够分别在局域网、浏览器和手机上完成不同工作。",
          },
          {
            en: "I led product work across Ustar, UstarCloud, UstarMobile and UstarAccess. My responsibilities covered product direction, requirements, backlog decisions and cross-functional delivery. I worked with a fixed ten-person team and could coordinate additional engineering capacity from other project teams for urgent iterations.",
            zh: "我负责 Ustar、UstarCloud、UstarMobile 和 UstarAccess 的产品工作，职责覆盖产品方向、需求、Backlog 决策与跨职能交付。我与固定的 10 人团队协作，并可在紧急迭代时从其他项目组协调额外研发资源。",
          },
        ],
      },
      {
        heading: { en: "Product architecture: four working contexts", zh: "产品架构：四种工作场景" },
        items: [
          { en: "Ustar supported local device, personnel, access-control and attendance operations on Windows and local networks.", zh: "Ustar 在 Windows 和局域网中支持设备、人员、门禁与考勤管理。" },
          { en: "UstarCloud extended administration into the browser across personnel, devices, authorisation, records, attendance, visitors, meetings, approvals and integrations.", zh: "UstarCloud 将人员、设备、授权、记录、考勤、访客、会议、审批和集成等管理能力扩展到浏览器端。" },
          { en: "UstarMobile gave employees access to check-in, attendance history, notifications, company information and account controls.", zh: "UstarMobile 为员工提供打卡、考勤历史、通知、企业信息和账户管理。" },
          { en: "UstarAccess extended mobile work into remote opening, access requests and meeting workflows for users needing greater control.", zh: "UstarAccess 为需要更高控制权限的用户扩展了远程开门、门禁申请和会议工作流。" },
        ],
      },
      {
        heading: { en: "Decision: offline was a product condition", zh: "决策：离线运行是产品基础条件" },
        paragraphs: [
          {
            en: "Customers operated across offices, factories and schools, sometimes with unreliable connectivity. A cloud-only design would have made essential work dependent on network quality. The portfolio separated local device operations, cloud administration and mobile workflows instead of forcing every role into one interface.",
            zh: "客户分布在办公室、工厂和学校，部分环境网络并不稳定。纯云端方案会让关键工作依赖网络质量，因此产品组合将本地设备操作、云端管理和移动工作流拆开，而不是强迫所有角色使用同一种界面。",
          },
          {
            en: "The sequence mattered: solve local operations first, then add browser administration, employee access and higher-control mobile capabilities as the needs became clearer.",
            zh: "建设顺序同样重要：先解决本地运营，再随着需求逐渐明确，增加浏览器管理、员工入口和更高权限的移动能力。",
          },
        ],
      },
      {
        heading: { en: "Compliance: change the architecture", zh: "合规：改变产品架构" },
        paragraphs: [
          {
            en: "European expansion exposed compliance risk in the original raw-face-image storage approach. I worked with the team to replace it with feature-value processing. We completed the architecture adjustment within one month and documented the requirements as a reusable compliance template for later international product lines.",
            zh: "进入欧洲市场时，原有的原始人脸图像存储方式暴露出合规风险。我与团队推动其转向特征值处理，在一个月内完成架构调整，并将相关要求整理为可供后续国际产品线复用的合规模板。",
          },
          {
            en: "Compliance was therefore not a final checklist. It changed what the system processed, how the pipeline was implemented and how later products approached international requirements.",
            zh: "合规不再是上线前的最后一张检查表，而是改变了系统处理什么数据、数据链路如何实现，以及后续产品如何面对国际化要求。",
          },
        ],
      },
      {
        heading: { en: "Market response: temperature screening", zh: "市场响应：测温产品" },
        paragraphs: [
          {
            en: "During COVID, customers began connecting access devices with temperature screening. The capability was not on the original roadmap. I proposed the business case, coordinated hardware, software and algorithm teams, and helped launch the product within six months.",
            zh: "疫情期间，客户开始询问门禁设备能否同时支持测温，这项能力原本不在 Roadmap 中。我提出商业案例，协调硬件、软件和算法团队，并在六个月内推动产品上市。",
          },
          {
            en: "The launch helped the company pursue opportunities in Africa and Latin America. It also showed how a time-sensitive market need could be translated into a coordinated product response across multiple technical disciplines.",
            zh: "该产品帮助公司拓展非洲和拉丁美洲的市场机会，也体现了如何把时效性很强的市场需求转化为跨多个技术领域协同推进的产品响应。",
          },
        ],
      },
      {
        heading: { en: "Commercial model: price around use", zh: "商业模式：围绕实际使用定价" },
        paragraphs: [
          {
            en: "A flat package could not reflect the difference between a small office using basic attendance and a larger organisation using more devices and administration capabilities. I helped redesign pricing around devices, users and feature modules.",
            zh: "统一套餐无法反映只使用基础考勤的小型办公室与使用更多设备和管理能力的大型组织之间的差异。我参与将定价重构为设备数、用户数和功能模块三个维度。",
          },
          {
            en: "The redesign aligned price more closely with customer scale and product use, and contributed to 15% year-on-year product-line revenue growth.",
            zh: "这次调整让价格更贴近客户规模与实际使用，并为产品线 15% 的年度收入增长作出了贡献。",
          },
        ],
      },
      {
        heading: { en: "Outcome and reflection", zh: "结果与反思" },
        paragraphs: [
          {
            en: "Across six major releases, the full Uspace portfolio cumulatively served 2,409 enterprise organisations and 29K monthly active users across 16 countries. These figures describe the complete portfolio, not any single application.",
            zh: "经过 6 个主要版本，完整 Uspace 产品组合累计服务 2,409 家企业组织和 29K 月活用户，覆盖 16 个国家。这些数字属于完整产品组合，而不是任何单一应用。",
          },
          {
            en: "The lasting lesson was a sequence of operating decisions: respect local constraints, separate workflows by role, make compliance architectural, and let commercial design reflect actual use.",
            zh: "这段经历留下的核心认知是一系列运营决策的顺序：尊重本地约束、按角色拆分工作流、把合规落实到架构，并让商业设计反映真实使用。",
          },
        ],
      },
    ],
  },
  {
    id: "uspace-china",
    kind: "work",
    title: { en: "Uspace China market platform", zh: "Uspace 中国市场平台" },
    subtitle: { en: "Adapting product patterns to China's channels, workflows and enterprise delivery environment.", zh: "把产品模式适配到中国的渠道、工作流和企业交付环境。" },
    metrics: [
      { value: "6", label: { en: "major platform releases", zh: "主要平台版本" } },
      { value: "6", label: { en: "Henan stakeholder groups", zh: "河南项目协调方" } },
      { value: "3 mo", label: { en: "Henan core delivery", zh: "河南核心交付周期" } },
    ],
    sections: [
      {
        heading: { en: "Context: localisation was not translation", zh: "背景：本地化不是翻译" },
        paragraphs: [
          { en: "The international portfolio relied on native apps and email-oriented account flows. Translating those interfaces would not have matched how employees accessed enterprise services through WeChat or how Chinese organisations expected attendance and access workflows to operate.", zh: "国际产品组合主要依赖原生 App 和以邮箱为中心的账户流程。翻译这些界面并不能适应员工通过微信使用企业服务的习惯，也无法满足国内企业对考勤和门禁工作流的预期。" },
          { en: "I led the adaptation by deciding which established product patterns should remain, which interactions needed to change and which customer requirements could become reusable platform capabilities.", zh: "我负责判断哪些已经验证的产品模式应该保留、哪些交互方式必须改变，以及哪些客户需求值得沉淀为可复用的平台能力。" },
        ],
      },
      {
        heading: { en: "Mobile strategy: rebuild around WeChat", zh: "移动策略：围绕微信重建" },
        paragraphs: [
          { en: "The team adapted essential UstarMobile and UstarAccess workflows into a WeChat Mini Program: check-in, attendance results, access requests and remote opening, meeting booking, notifications, directory access and account controls.", zh: "团队把 UstarMobile 和 UstarAccess 的关键工作流适配到微信小程序，包括打卡、考勤结果、门禁申请与远程开门、会议预约、通知、通讯录和账户管理。" },
          { en: "GPS- and Wi-Fi-based check-in and WeChat-oriented authentication reduced installation and learning friction. The product scope was organised around the workflows employees needed to complete rather than a direct copy of the native apps.", zh: "基于 GPS 与 Wi-Fi 的打卡方式和微信认证降低了安装与学习成本。产品范围围绕员工需要完成的工作流组织，而不是直接复制原生 App。" },
        ],
      },
      {
        heading: { en: "Administration: manage a broad platform", zh: "管理后台：管理广泛的平台能力" },
        paragraphs: [
          { en: "The platform covered personnel, devices, authorisation, entry and recognition records, holidays, access control, attendance, reports, visitors, permissions, meetings, approvals, integrations and operation logs. I managed priorities across these areas while the team delivered six major platform releases.", zh: "平台覆盖人员、设备、授权、出入与识别记录、节假日、门禁、考勤、报表、访客、权限、会议、审批、集成和操作日志。我在这些能力之间管理优先级，并推动团队交付 6 个主要平台版本。" },
          { en: "Managing the platform as connected workflow groups helped the team make trade-offs across administration, employee experience and enterprise delivery without treating every screen as an isolated feature.", zh: "把平台作为相互连接的工作流来管理，帮助团队在管理后台、员工体验和企业交付之间作出取舍，而不是把每个页面视为孤立功能。" },
        ],
      },
      {
        heading: { en: "Enterprise delivery: Henan smart campus", zh: "企业交付：河南智慧校园" },
        paragraphs: [
          { en: "The Henan Yuzi project brought together the education bureau, schools, a hardware supplier, a software integrator, a telecom operator and Uniubi's internal team. I coordinated the six parties, separated core delivery from later improvements and used regular progress alignment to manage dependencies.", zh: "河南豫资项目涉及教育局、学校、硬件供应商、软件集成商、运营商和宇泛内部团队。我负责协调六方，将核心交付与后续改进拆开，并通过固定进度同步管理依赖。" },
          { en: "The core project was delivered on time in three months, and the delivery model was later reused in other regions.", zh: "核心项目在三个月内按时交付，相关交付模式后来复用到其他地区。" },
        ],
      },
      {
        heading: { en: "Productisation: XIZI Elevator", zh: "产品化：西子电梯" },
        paragraphs: [
          { en: "XIZI Elevator required elevator-control capability that was not yet part of the standard platform. The project created a working solution, and the capability later entered the standard Uspace product.", zh: "西子电梯需要当时标准平台尚未具备的电梯控制能力。项目先形成可用方案，相关能力后来进入 Uspace 标准产品。" },
          { en: "The team looked for evidence that a custom request represented a repeatable need before absorbing it into the platform, rather than treating every request as a permanent one-off.", zh: "团队会先判断定制需求是否代表可重复的市场需要，再决定是否沉淀进平台，而不是把每个需求永久保留为一次性开发。" },
        ],
      },
      {
        heading: { en: "Reflection", zh: "反思" },
        paragraphs: [{ en: "The value came from preserving useful product logic while redesigning channels, interactions and delivery around local conditions. Localisation was a product and operating-model decision, not a language task.", zh: "真正的价值来自保留有效的产品逻辑，同时围绕本地条件重新设计渠道、交互和交付方式。本地化是产品与运营模式决策，而不是语言任务。" }],
      },
    ],
  },
  {
    id: "operations",
    kind: "work",
    title: { en: "Operations analytics and supply-chain visibility", zh: "运营分析与供应链可视化" },
    subtitle: { en: "Connecting hardware delivery, quality and product-use signals into a shared decision system.", zh: "把硬件交付、质量与产品使用信号连接成共享决策系统。" },
    sections: [
      {
        heading: { en: "Context: an operational blind spot", zh: "背景：一个运营盲区" },
        paragraphs: [
          { en: "While managing software products at Uniubi, I repeatedly saw hardware catalogue, supplier, delivery and quality information distributed across systems and teams. The data existed, but there was no shared view for examining how delivery and quality risks affected customers.", zh: "在宇泛负责软件产品期间，我反复看到硬件产品目录、供应商、交付和质量信息分散在不同系统与团队中。数据真实存在，但团队缺少共同视图来判断交付与质量风险如何影响客户。" },
          { en: "This was outside my formal roadmap. I proposed the opportunity and drove the construction of an operations-visibility system alongside my core product responsibilities.", zh: "这并不属于我的正式 Roadmap。我主动提出这一机会，并在核心产品职责之外推动建设运营可视化系统。" },
        ],
      },
      {
        heading: { en: "What the system connected", zh: "系统连接了什么" },
        items: [
          { en: "SKU and product-catalogue data and supplier information.", zh: "SKU、产品目录数据和供应商信息。" },
          { en: "Order and delivery-stage tracking to make progress and delay risk visible.", zh: "订单与交付阶段追踪，使进度和延期风险可见。" },
          { en: "Component- and supplier-level defect-rate monitoring and material-shortage alerts.", zh: "部件与供应商维度的缺陷率监控和物料短缺预警。" },
          { en: "Tableau management dashboards for shared operational review.", zh: "用于共同运营复盘的 Tableau 管理看板。" },
          { en: "Analysis linking hardware fault or quality data with software usage and customer-support signals.", zh: "把硬件故障或质量数据与软件使用、客户支持信号关联分析。" },
        ],
      },
      {
        heading: { en: "Decision: connect signals, not another isolated dashboard", zh: "决策：连接信号，而不是再建一个孤立看板" },
        paragraphs: [
          { en: "A catalogue view alone could not explain delivery risk, and a defect dashboard alone could not show whether hardware problems changed software behaviour or support demand. The system joined these signals so teams could investigate relationships rather than isolated totals.", zh: "只有产品目录无法解释交付风险，只有缺陷看板也无法判断硬件问题是否改变了软件行为或客服需求。因此系统连接这些信号，让团队调查它们之间的关系，而不只是查看孤立总数。" },
          { en: "The system created a more coherent operational view, but it did not replace operational judgement or capture every process. Teams still needed to investigate the context behind shortages, defects and changes in support demand.", zh: "该系统提供了更连贯的运营视图，但没有取代运营判断，也没有覆盖每一个流程。团队仍需调查缺料、缺陷和客服需求变化背后的具体情境。" },
        ],
      },
      {
        heading: { en: "How it changed the work", zh: "它如何改变工作方式" },
        paragraphs: [{ en: "Product and operations teams gained a shared way to review delivery stages, shortage risks and quality trends. Supplier discussions could refer to observed patterns, while product teams could explore whether hardware issues were associated with software behaviour or support demand.", zh: "产品和运营团队获得了共同复盘交付阶段、缺料风险和质量趋势的方式。供应商沟通可以引用观察到的模式，产品团队也能继续分析硬件问题是否与软件使用行为或客服需求相关。" }],
      },
      {
        heading: { en: "My role and reflection", zh: "我的角色与反思" },
        paragraphs: [
          { en: "I identified the recurring blind spot, made the case for the work and drove the system direction. The result depended on operational data and collaboration across the business; it was not the work of one person implementing every source and dashboard.", zh: "我识别出反复出现的运营盲区，提出建设理由并推动系统方向。最终结果依赖企业内部的运营数据和跨团队协作，并不是一个人实现所有数据源和看板。" },
          { en: "The project taught me to look for repeated decision failures caused by disconnected information, then test whether joining existing signals could improve the work before proposing another standalone tool.", zh: "这个项目让我学会观察由信息割裂导致的重复决策失效，并在提出新的独立工具前，先判断连接既有信号是否能够改善工作。" },
        ],
      },
    ],
  },
  {
    id: "kreai",
    kind: "work",
    title: { en: "KreAI creator business platform", zh: "KreAI 创作者商务平台" },
    subtitle: { en: "Building an AI-assisted negotiation workflow, then learning where automation should stop.", zh: "构建 AI 辅助谈判工作流，并认识自动化应该停止的位置。" },
    metrics: [
      { value: "6", label: { en: "versions in 6 months", zh: "6 个月内的版本" } },
      { value: "7", label: { en: "cross-functional team members", zh: "跨职能团队成员" } },
      { value: "5", label: { en: "workflow stages", zh: "工作流阶段" } },
      { value: "10", label: { en: "comparison customers", zh: "方向性比较样本客户" } },
    ],
    sections: [
      {
        heading: { en: "Context: from idea to working product", zh: "背景：从想法到可运行产品" },
        paragraphs: [{ en: "KreAI explored whether AI could help creators identify brand opportunities and manage the email work required to move collaborations towards agreement. As the sole product lead in a seven-person cross-functional team, I owned product direction, requirements and iteration while the team delivered six versions in six months.", zh: "KreAI 探索 AI 是否能够帮助创作者发现品牌机会，并管理把合作推进到达成协议所需的邮件工作。作为 7 人跨职能团队中唯一的产品负责人，我负责产品方向、需求和迭代，团队在 6 个月内交付了 6 个版本。" }],
      },
      {
        heading: { en: "Product model: five collaboration stages", zh: "产品模型：五阶段合作工作流" },
        paragraphs: [
          { en: "The product connected to a creator's mailbox, identified potential collaborations and organised them into Initial Outreach, Content Alignment, Price Negotiation, Contract Review and Deal Confirmation. It also included opportunity discovery, creator profiles, task generation and tiered subscription flows with Stripe integration.", zh: "产品连接创作者邮箱，识别潜在合作，并将其组织为初次联系、内容对齐、价格谈判、合同审核和确认合作五个阶段。产品还包括商机发现、创作者资料、任务生成，以及接入 Stripe 的分层订阅流程。" },
          { en: "The workflow made progress visible, but raised a harder question: which decisions could be delegated to AI, and which required the creator to retain responsibility?", zh: "工作流让合作进度变得可见，但也提出了更困难的问题：哪些决策可以交给 AI，哪些责任必须保留给创作者本人？" },
        ],
      },
      {
        heading: { en: "Research: find the failure point", zh: "研究：找到失效位置" },
        paragraphs: [
          { en: "The MVP initially automated all five stages. Early research combined questionnaires, observation and, with permission, review of emails produced by the system. Eight of ten early testers encountered problems during pricing or contract work.", zh: "MVP 最初自动执行全部五个阶段。早期研究结合问卷、观察，以及在获得允许后查看系统生成的邮件。10 名早期测试用户中，有 8 人在定价或合同阶段遇到问题。" },
          { en: "Formula-based pricing was too rigid for individual deals, while contract generation moved between unsupported clauses and overly fixed templates. The risk involved money, legal commitments and user trust, not only model quality.", zh: "公式化报价难以适应每笔合作，合同生成则会在缺乏依据的条款和过度固定的模板之间摇摆。风险涉及金额、法律承诺和用户信任，而不只是模型质量。" },
        ],
      },
      {
        heading: { en: "Decision: AI drafts, humans confirm", zh: "决策：AI 起草，人工确认" },
        paragraphs: [
          { en: "I changed Price Negotiation and Contract Review to an AI-draft plus human-confirmation model. Lower-risk stages could remain automated, while creators reviewed communication involving money or contractual responsibility.", zh: "我将价格谈判和合同审核改为“AI 起草 + 人工确认”。风险较低的阶段可以继续自动化，而涉及金额或合同责任的沟通由创作者审核。" },
          { en: "This was a product boundary rather than a hidden technical limitation: AI could reduce repetitive work, but it should not silently take responsibility for consequential commitments.", zh: "这是一条产品边界，而不是被掩盖的技术限制：AI 可以减少重复工作，但不应该在用户不知情的情况下承担重要承诺。" },
        ],
      },
      {
        heading: { en: "Measurement: directional, not causal", zh: "衡量：方向性结果，而非因果结论" },
        paragraphs: [
          { en: "Ten sample customers each used two product versions for two weeks on their own mailbox data. Product event tracking and manual records showed full five-stage completion moving from approximately 30% to 38%, a relative improvement of approximately 25%.", zh: "10 个样本客户分别使用两个产品版本处理各两周自己的邮箱数据。产品埋点和人工记录显示，完整走完五阶段的比例约从 30% 提升到 38%，相对提升约 25%。" },
          { en: "The comparison was small and non-randomised, and deal difficulty was not controlled. It justified continued testing, but did not establish causality or predict results for the wider population.", zh: "比较样本较小、没有随机分组，也没有控制合作难度。它为继续验证提供了方向，但不能证明因果关系，也不能代表更广泛用户群体。" },
        ],
      },
      {
        heading: { en: "Business outcome and reflection", zh: "商业结果与反思" },
        paragraphs: [
          { en: "The product reached a working state, but acquisition did not extend beyond approximately 100 seed users from the founder's network. The project later ended amid acquisition and fundraising constraints.", zh: "产品达到了可运行状态，但获客没有突破创始人人脉带来的约 100 个种子用户。项目后来因获客和融资限制而结束。" },
          { en: "Shipping six versions demonstrated delivery speed, but did not create repeatable distribution. The experience taught me to test product, trust and acquisition assumptions together, and to stop automation where users must retain responsibility.", zh: "交付 6 个版本证明了执行速度，但没有形成可重复的分发渠道。这段经历让我认识到产品、信任和获客假设需要同时验证，并在用户必须保留责任的位置停止自动化。" },
        ],
      },
    ],
  },
  {
    id: "urgent-lab",
    kind: "research",
    title: { en: "Designing a safer urgent lab alert workflow", zh: "设计更安全的紧急检验结果提醒流程" },
    subtitle: { en: "Turning communication delay, security concerns and clinical accountability into a traceable prototype workflow.", zh: "把沟通延迟、安全要求和临床责任转化为可追踪的原型工作流。" },
    metrics: [
      { value: "9", label: { en: "healthcare survey participants", zh: "医疗专业人士问卷参与者" } },
      { value: "1", label: { en: "separate expert interview", zh: "独立专家访谈" } },
      { value: "8/9", label: { en: "identified communication delay", zh: "将沟通延迟视为主要问题" } },
    ],
    prototypeUrl: "https://www.figma.com/proto/v4MRVKb37qExh5NCod3w1K/HCIPD-Final?node-id=1-4667&p=f&viewport=254%2C108%2C0.14&t=QWooaSMQgBs3iMM6-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1",
    sections: [
      {
        heading: { en: "Research question", zh: "研究问题" },
        paragraphs: [
          { en: "How might urgent laboratory results reach the responsible clinical team securely and quickly, while making acknowledgement, ownership and action visible?", zh: "如何安全、快速地把紧急检验结果传递给负责的临床团队，同时让确认接收、责任归属和处理状态清晰可见？" },
          { en: "The project focused on the communication handoff rather than attempting to replace the wider hospital information system.", zh: "项目聚焦于沟通交接环节，而不是尝试替代更广泛的医院信息系统。" },
        ],
      },
      {
        heading: { en: "Participants and methods", zh: "参与者与研究方法" },
        paragraphs: [
          { en: "The team combined a literature review, a Google Forms survey of nine healthcare professionals and one separate expert interview with Dr Grace. Survey participants were five doctors, two laboratory staff and two consultant microbiologists.", zh: "团队结合文献综述、9 名医疗专业人士参与的 Google Forms 问卷，以及与 Dr Grace 的一场独立专家访谈。问卷参与者包括 5 名医生、2 名实验室工作人员和 2 名顾问微生物学家。" },
          { en: "Findings informed workflow mapping, role-based requirements, sender and recipient flows and iterative prototyping.", zh: "研究结果用于工作流梳理、基于角色的需求、发送方与接收方流程，以及迭代原型设计。" },
        ],
      },
      {
        heading: { en: "Findings: sending did not close the loop", zh: "研究发现：发出通知不等于完成沟通" },
        items: [
          { en: "Eight of nine survey participants identified communication delay as a major problem.", zh: "9 名问卷参与者中有 8 名将沟通延迟视为主要问题。" },
          { en: "Participants also raised missed alerts, incomplete context, unclear responsibility, technical failure and information-security concerns.", zh: "参与者还提出提醒遗漏、信息不完整、责任不清、技术故障和信息安全风险。" },
          { en: "The workflow needed acknowledgement, ownership, tracking and escalation, not only a notification.", zh: "工作流需要确认、责任归属、追踪与升级机制，而不只是通知。" },
        ],
      },
      {
        heading: { en: "Design response", zh: "设计回应" },
        paragraphs: [
          { en: "The prototype used structured alert creation to capture patient, laboratory and urgency context, then connected proposed secure delivery, a named recipient, acknowledgement and visible status. Ongoing and completed states made responsibility transfer easier to follow.", zh: "原型通过结构化提醒创建收集患者、实验室和紧急程度信息，再连接拟议的安全传递、明确接收人、确认接收与可见状态。进行中和已完成状态让责任转移更容易追踪。" },
          { en: "Separate sender and recipient flows reflected different role needs. Escalation was part of the prototype concept, not a claim that a clinical escalation system had been implemented.", zh: "发送方与接收方使用独立流程，以反映不同角色需求。升级机制属于原型概念，并不意味着已经实现临床升级系统。" },
        ],
      },
      {
        heading: { en: "My contribution", zh: "我的贡献" },
        paragraphs: [{ en: "Within the multidisciplinary HCI team, I contributed product problem framing, research synthesis, requirements definition and prototype evaluation, working with teammates across the wider research and design process.", zh: "在跨学科 HCI 团队中，我参与产品问题定义、研究归纳、需求定义和原型评估，并与团队成员共同完成更广泛的研究和设计工作。" }],
      },
      {
        heading: { en: "Limitations and next validation", zh: "局限与下一步验证" },
        paragraphs: [
          { en: "This was an exploratory academic project with nine survey participants and one expert interview. It evaluated a prototype rather than a deployed clinical system, and no formal target-user usability study is documented.", zh: "这是一个探索性学术项目，包含 9 名问卷参与者和 1 名专家访谈对象。项目评估的是原型而不是已经部署的临床系统，也没有记录正式的目标用户可用性研究。" },
          { en: "Hospital integration, escalation rules, security implementation and real-world response times require further clinical and technical validation.", zh: "医院系统集成、升级规则、安全实现和真实响应时间仍需进一步的临床与技术验证。" },
          { en: "The next step would be to test sender and recipient flows with clinical users, then validate integration constraints and acknowledgement timing in a controlled healthcare environment.", zh: "下一步应与临床用户测试发送方和接收方流程，再在受控医疗环境中验证集成约束和确认时效。" },
        ],
      },
    ],
  },
  {
    id: "lawmate",
    kind: "research",
    title: { en: "Lawmate: accessible legal aid", zh: "Lawmate：更易获得的法律援助" },
    subtitle: { en: "Exploring how international residents in Ireland could understand legal information and reach credible, affordable support.", zh: "探索如何帮助居住在爱尔兰的国际人士理解法律信息，并获得可信且可负担的支持。" },
    metrics: [
      { value: "2", label: { en: "users in prototype comparison", zh: "原型比较参与用户" } },
      { value: "2", label: { en: "early concept directions", zh: "早期概念方向" } },
    ],
    prototypeUrl: "https://www.figma.com/proto/XSsl40Z5r68NE9I2dRzxQv/Lawmate-Final-App?type=design&node-id=0-21&t=ibivNRj7rpvdpc4O-1&scaling=min-zoom&page-id=0%3A1&starting-point-node-id=0%3A21&mode=design",
    sections: [
      {
        heading: { en: "Research question", zh: "研究问题" },
        paragraphs: [
          { en: "How might international residents in Ireland understand legal information while preserving privacy and reaching credible, affordable support?", zh: "如何帮助居住在爱尔兰的国际人士理解法律信息，同时保护隐私并获得可信、可负担的支持？" },
          { en: "The project examined the steps before formal legal advice: recognising a problem, understanding options and finding an appropriate route to further help.", zh: "项目关注正式法律建议之前的环节：识别问题、理解可能选项，并找到进一步获得帮助的合适路径。" },
        ],
      },
      {
        heading: { en: "Methods", zh: "研究方法" },
        paragraphs: [
          { en: "The multidisciplinary student team used a survey, target-user research, a Legal Aid Board interview, personas, concept testing and heuristic evaluation. The team also completed an internal card sort and compared two early prototypes with two users.", zh: "跨学科学生团队使用了问卷、目标用户研究、Legal Aid Board 访谈、用户画像、概念测试和启发式评估。团队还完成了内部卡片分类，并邀请两名用户比较两个早期原型。" },
          { en: "The internal card sort helped organise the proposed information architecture, but it did not represent an independent user study.", zh: "内部卡片分类帮助团队组织拟议的信息架构，但不能被视为独立用户研究。" },
        ],
      },
      {
        heading: { en: "Key tensions", zh: "核心矛盾" },
        items: [
          { en: "Community participation could make shared knowledge more approachable, but introduced misinformation, harassment and privacy risks.", zh: "社区参与可以让共享知识更容易接近，但也会引入错误信息、骚扰和隐私风险。" },
          { en: "Professional consultation offered greater credibility, while affordability and availability remained barriers.", zh: "专业咨询更加可信，但价格和可获得性仍然是障碍。" },
          { en: "Legal information needed to be understandable without presenting an early concept as legal advice.", zh: "法律信息需要容易理解，同时不能把早期概念包装成法律建议。" },
        ],
      },
      {
        heading: { en: "Concept evolution", zh: "概念如何演进" },
        paragraphs: [
          { en: "The team explored a community-led direction and a professional-consultation direction. The two-user comparison suggested neither was sufficient alone, so the final concept combined approachable resources, anonymous participation and a route towards professional consultation.", zh: "团队探索了社区主导和专业咨询两种方向。两名用户参与的比较表明，单独使用任何一种方向都不够，因此最终概念结合了易于理解的资源、匿名参与和通往专业咨询的路径。" },
          { en: "The prototype explored resource discovery, community questions, identity controls and private consultation flows. These were design proposals, not evidence that a secure legal-service platform had been implemented.", zh: "原型探索了资源发现、社区提问、身份控制和私人咨询流程。这些是设计方案，并不能证明已经实现安全的法律服务平台。" },
        ],
      },
      {
        heading: { en: "Information architecture and evaluation", zh: "信息架构与评估" },
        paragraphs: [
          { en: "Research themes became topic-led resources, a legal glossary, community participation and routes to professional help. The team used the internal card sort, task flows and heuristic review to structure and critique the concept.", zh: "团队把研究主题转化为按主题组织的资源、法律术语表、社区参与和专业帮助路径，并通过内部卡片分类、任务流程和启发式评估组织与审视概念。" },
          { en: "The two-user comparison valued information and anonymity, while pointing to clearer navigation, larger default text, stronger device-security expectations and more responsive prototype controls.", zh: "两名用户参与的比较反馈肯定了信息价值和匿名性，同时提出需要更清晰的导航、更大的默认字号、更强的设备安全预期，以及响应更好的原型控件。" },
        ],
      },
      {
        heading: { en: "My contribution", zh: "我的贡献" },
        paragraphs: [{ en: "I contributed research synthesis, information architecture and product-design collaboration within the multidisciplinary student team, working with teammates to turn research findings into the final concept and prototype.", zh: "我在跨学科学生团队中参与研究归纳、信息架构和产品设计协作，并与团队成员共同把研究发现转化为最终概念和原型。" }],
      },
      {
        heading: { en: "Limitations and next validation", zh: "局限与下一步验证" },
        paragraphs: [
          { en: "The prototype comparison involved two users, the card sort was conducted within the team and several product areas remained incomplete. Lawmate is an early design direction, not a validated legal-service model or a source of legal advice.", zh: "原型比较只有两名用户，卡片分类由团队内部完成，并且部分产品区域尚未完成。Lawmate 是早期设计方向，不是经过验证的法律服务模式，也不提供法律建议。" },
          { en: "Further work would require broader target-user research, legal and privacy specialists, content governance, moderation design and testing of the handoff to qualified professional support.", zh: "后续工作需要更广泛的目标用户研究、法律与隐私专家参与、内容治理、社区管理设计，以及对接合格专业支持流程的测试。" },
        ],
      },
    ],
  },
];

export const WORK_ENTRIES = PORTFOLIO_ENTRIES.filter((entry) => entry.kind === "work");
export const RESEARCH_ENTRIES = PORTFOLIO_ENTRIES.filter((entry) => entry.kind === "research");
