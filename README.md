# 知时 · 东方人生导航 MVP

这是 Project ZHISHI 的第一轮可运行产品骨架，包含响应式 Web 原型、FastAPI API 骨架，以及面向 iOS / Android 的 Expo + React Native 移动端。

## 当前覆盖

- 今天 / 回看 / 今年 / 命盘四栏原生导航；“有点乱”并入“今天”，不再占用一套重复入口
- “今天”和“今年”共用回答优先的 DeepSeek 对话：每轮先给明确结论、一个带时间与完成标准的下一步、2—3 个现实案例和风险边界，再只追问一个关键问题
- 用户补充后，服务端必须引用最新回复并重写完整建议；今天聚焦未来 24—72 小时的可逆动作，今年聚焦未来 30—90 天的计划和检查点
- Today 支持用户主动保存能量、压力、感受和关注领域；对话可结合今天状态与最少量已审计命盘事实，没有命盘时今天仍可只依据现实信息回应
- 回看展示用户真实保存的每日状态趋势与旧事实梳理时间线，支持更新、全文搜索、感受筛选、详情回看、系统分享导出、逐条删除和统一清除
- 今年只读取用户主动保存的真实命盘，展示审计通过的当前大运、流年、流月与精确边界，并把文化线索转成可核对的规划问题而不是事件预测
- 通用“为什么这么判断？”证据链展开
- 安全边界、出生资料准确性提示与使用条款草案
- FastAPI API 骨架：Onboarding、Daily、AnxietySession、Journey、Year
- `zhishi-bazi-core`：时区、历史夏令时、平/真太阳时、精确节气、大运顺逆与起运时间、当前大运、立春流年、十二节流月、三路规则审计，以及 NOAA/HKO 官方黄金基准
- 统一 EvidenceChain 结构和高风险安全分流
- React Native 移动端：Daily / Journey / Year、现实记录闭环、出生地自动解析、真实出生资料表单、四柱/当前周期审计展示和用户主动本机保存

## 本地运行

前端：

```bash
npm run dev
```

然后打开 `http://127.0.0.1:4173/`。

API：

```bash
cd services/api
python -m uvicorn app.main:app --reload --port 8000
```

健康检查地址：`http://127.0.0.1:8000/health`

当前用户与导航数据仍使用内存存储；四柱排盘已接入真实计算引擎，尚未接入真实账户或 PostgreSQL。DeepSeek 只用于用户主动发起的对话指导：服务端重新计算并审计可用命盘上下文，同时把用户现实输入作为独立证据；模型不能修改命盘、补算强弱喜忌、预测事件或替用户做医疗、法律、财务及其他重大决定。旧的无上下文今日建议和静态年度解释接口仍主动停用。

真实排盘接口：`POST /api/v1/bazi/charts/calculate`；当前大运与流年接口：`POST /api/v1/bazi/context/current`。详细输入、规则和验证方式见 [`services/api/README.md`](services/api/README.md)。

欧美上线内部法务基线见 [`LEGAL_NOTICE.md`](LEGAL_NOTICE.md)，客户侧英文草案见 [`TERMS_OF_USE.md`](TERMS_OF_USE.md) 与 [`PRIVACY_NOTICE.md`](PRIVACY_NOTICE.md)。这些文件用于产品设计和律师交接，不替代美国、欧盟/欧洲经济区及英国执业律师的正式意见。

移动端：

```bash
cd apps/mobile
npm install
npm run start
```

Expo Go 可用于快速预览；`npm run android` 和 `npm run ios` 分别用于 Android / iOS 原生运行。Windows 可直接开发 Android，iOS 原生编译需要 macOS + Xcode。移动端 API 地址通过 `EXPO_PUBLIC_API_BASE_URL` 配置。
