# 知时欧美上线法务与合规基线（内部草案）

版本日期：2026-08-15

> 本文件用于产品设计、工程验收和律师交接，不构成法律意见。目标市场为美国、欧盟/欧洲经济区与英国。正式上线前必须由相关市场的执业律师复核实际经营主体、数据流、收费模式、营销文案和消费者条款。

## 1. 文件结构

- [`TERMS_OF_USE.md`](TERMS_OF_USE.md)：面向欧美客户的英文使用条款草案。
- [`PRIVACY_NOTICE.md`](PRIVACY_NOTICE.md)：面向欧美客户的英文隐私声明与 California Notice at Collection 草案。
- 本文件：内部合规依据、产品要求和上线阻断项。

客户侧文件不再引用中国法律。若未来向其他司法辖区主动提供服务，应增加相应地区附录，而不是混用一套条款。

## 2. 已锁定的产品表述

1. 排盘按用户提交的日期、具体时刻、地点、时区、时间精度与规则选项计算。
2. 用户选择“约 ±30 分钟”或“约 ±60 分钟”后仍正常计算；同时提醒实际时刻偏差可能改变四柱、大运、流年和流月，并展示误差区间候选。
3. 确定性计算事实与文化解释必须分层显示。当前 DeepSeek 解释必须标识 AI、逐段引用允许的确定性证据，不得把 AI 文本包装成计算引擎事实。
4. 命理内容仅供文化、信息和娱乐参考，不构成医疗、心理、法律、财务、就业或其他专业建议，也不得作为重大决定的唯一依据。
5. 不使用“注定”“必然”等表述制造恐惧，不预测灾祸、生死或疾病，不承诺结果。
6. 当前 MVP 不销售个人数据、不投放行为广告、不接广告 SDK、不做账户云同步；命盘仅在用户主动保存后写入本机。
7. DeepSeek 只接收服务端审计后的最小事实包、关注领域和可选问题，不接收出生日期、地点名或经纬度；请求正文不得写日志，API Key 只保存在 Render 后端。

## 3. 欧洲基线

### GDPR / UK GDPR

- 在收集前说明控制者身份、数据类别、处理目的、法律依据、接收方、跨境传输、保存期限、用户权利、投诉渠道和自动化处理。
- 默认采取数据最小化、目的限制、最短保存、访问控制和隐私设计。
- 排盘所必需的出生资料可按履行用户请求的服务处理；非必要分析、营销或跟踪不得捆绑在服务同意中。
- 日记、压力和健康相关输入可能构成敏感数据；未完成额外法律依据和保护措施前，不得用于画像、广告或模型训练。
- 在欧盟/英国境外处理数据前，确认充分性决定或完成 SCC/英国传输机制、供应商 DPA 和必要的传输影响评估。
- DeepSeek 现行隐私材料声明数据在中国处理和存储，且公开条款允许在严格去标识后有限用于维护或改进服务；在 DPA、SCC/UK 机制、传输影响评估、保留/训练用途控制和数据主体请求协助均确认前，不得向 EU/EEA/UK 公众开放 AI 解读。

### ePrivacy / PECR

- 非必要 Cookie、广告标识符、分析 SDK 或设备追踪在启用前应完成适用的同意机制。
- 当前 MVP 保持无广告、无行为分析 SDK，可减少早期合规面。

### EU AI Act

- 截至本草案日期，Article 50 透明度义务已自 2026-08-02 起适用。
- 若上线与用户直接交互的 AI、AI 生成解释或合成内容，必须按适用范围进行清晰披露和技术标记。
- 自研历法计算本身属于确定性规则引擎，不应被错误标为 AI；AI 只能在解释层明确出现。

### 消费者保护

- 欧盟/英国消费者的强制性撤回、取消、数字服务符合性、退款和不公平条款保护不得通过免责声明排除。
- 付费上线前必须在购买前清楚展示总价、周期、自动续费、取消路径、试用转付费条件和退款政策。

## 4. 美国基线

### FTC 消费者保护

- 应用商店、广告、落地页和产品内关于准确性、隐私、安全、健康或效果的客观主张必须真实且有证据支持。
- 限制条件必须靠近相关主张、清晰醒目、普通用户能理解；不能用隐藏链接或小字修复具有误导性的主要文案。
- 对出生资料、精确地点、心理/健康相关内容等敏感信息，应在非显而易见的收集或分享前取得明确授权。

### 美国州隐私法

- 若达到 CCPA/CPRA 或其他州法适用门槛，应在收集时提供类别、目的、出售/共享状态和保存期限，并建立访问、更正、删除、选择退出及申诉流程。
- 当前产品基线为不出售、不用于跨情境行为广告；若商业模式改变，必须先实现 Do Not Sell or Share、适用的 Global Privacy Control 和敏感数据限制机制。
- California 2025 年通过的风险评估、网络安全审计和 ADMT 规则已于 2026-01-01 生效；达到适用条件时应单独评估。

### 儿童与健康相关数据

- 产品定位 18+。公开账户注册前应增加中性的年龄确认和未成年人删除流程。
- 对已知 13 岁以下用户，不得在未满足 COPPA 通知与可验证家长同意要求时收集个人信息。
- 若产品未来成为可从多来源汇集可识别健康信息的个人健康记录服务，应评估 FTC Health Breach Notification Rule；当前不得宣传诊断、治疗或健康结果。

## 5. 上线阻断项

以下信息确定前，英文条款只能作为草案，不能让用户正式接受：

1. 公司法定名称、注册地址、客服邮箱和隐私请求渠道。
2. 首发国家、美国首发州、EU/UK 代表和是否需要 DPO。
3. API、数据库、日志、备份和客服数据的实际托管国家及供应商。
4. 账户、云同步、分析、崩溃报告、AI 模型、支付和邮件供应商清单。
5. DeepSeek API 的 DPA、EU SCC/UK transfer mechanism、传输影响评估、实际 API 输入/输出保留期限、训练/改进用途控制及删除协助。
6. 各类数据的实际保存期限与删除实现。
7. 免费、一次性购买或订阅模式，以及退款、续费和税务处理。
8. 争议管辖、保险、责任上限与是否采用仲裁；不得在主体未确定时凭空写入。

## 6. 工程上线清单

### P0：外部测试前

- 收集出生资料前提供简短隐私提示并可进入完整 Privacy Notice。
- 请求正文不写入生产日志；全链路 TLS；密钥不进入客户端或仓库。
- 用户可清除本机数据；账户上线时同步提供导出、删除和更正。
- 建立供应商清单、DPA、跨境传输机制、最小权限和事件响应流程。
- 不接入非必要追踪 SDK；如需接入，先完成同意管理和拒绝后的等价体验。
- 年龄确认、条款接受版本和隐私声明版本可审计。

### P1：付费上线前

- 购买页完成价格、周期、续费、取消、退款和 EU/UK 消费者权利展示。
- 完成美国州隐私请求流程、California Notice at Collection 和适用的选择退出信号。
- 完成 AI 解释标识、提示词/输出安全评估和人工可追溯日志策略。
- DeepSeek 面向 EU/EEA/UK 开放前完成供应商 DPA、跨境传输机制与数据保留/改进用途核验；无法满足时切换到可签署欧美数据处理条款且可禁用训练的供应商。
- 由美国与欧洲律师分别审查 Terms、Privacy Notice、App Store 文案和营销页面。

## 7. 官方依据

- EU GDPR 原则与告知义务：<https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en>
- EU GDPR 法律依据：<https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en>
- ePrivacy Directive 2002/58/EC：<https://eur-lex.europa.eu/eli/dir/2002/58/oj>
- EU Consumer Rights Directive 2011/83/EU：<https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0083>
- EU Digital Content and Services Directive 2019/770：<https://eur-lex.europa.eu/eli/dir/2019/770/oj>
- EU AI Act 2024/1689 Article 50 / Article 113：<https://eur-lex.europa.eu/eli/reg/2024/1689/oj>
- UK GDPR / DPA 2018 与 Data (Use and Access) Act 2025：<https://www.gov.uk/government/collections/data-use-and-access-act-2025>
- FTC mobile app guidance：<https://www.ftc.gov/business-guidance/resources/marketing-your-mobile-app-get-it-right-start>
- FTC digital disclosures：<https://www.ftc.gov/business-guidance/resources/com-disclosures-how-make-effective-disclosures-digital-advertising>
- FTC COPPA guidance：<https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy>
- FTC Health Breach Notification Rule：<https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule>
- California CCPA notice requirements：<https://cppa.ca.gov/pdf/general_notices.pdf>
- California 2025 CCPA/ADMT regulations：<https://cppa.ca.gov/regulations/ccpa_updates.html>
