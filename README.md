# 知时 · 东方人生导航 MVP

这是 Project ZHISHI 的第一轮可运行产品骨架，包含响应式 Web 原型、FastAPI API 骨架，以及面向 iOS / Android 的 Expo + React Native 移动端。

## 当前覆盖

- Daily / Journey / Year 三模式主导航
- Today 只显示已保存命盘的审计周期；没有命盘或审计失败时不生成个人判断
- “我现在有点乱”三步澄清流程只整理用户实际输入，当前不自动保存或生成结论
- Journey 在真实记录模块接入前显示明确空状态，不伪造章节进度
- 一年导航只读取用户主动保存的真实命盘，展示审计通过的当前大运、流年、流月与精确边界
- 通用“为什么这么判断？”证据链展开
- 安全边界、出生资料准确性提示与使用条款草案
- FastAPI API 骨架：Onboarding、Daily、AnxietySession、Journey、Year
- `zhishi-bazi-core`：时区、历史夏令时、平/真太阳时、精确节气、大运顺逆与起运时间、当前大运、立春流年、十二节流月、三路规则审计，以及 NOAA/HKO 官方黄金基准
- 统一 EvidenceChain 结构和高风险安全分流
- React Native 移动端：Daily / Journey / Year、出生地自动解析、真实出生资料表单、四柱/当前周期审计展示和用户主动本机保存

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

当前用户与导航数据仍使用内存存储；四柱排盘已接入真实计算引擎，尚未接入真实账户或 PostgreSQL。DeepSeek 只用于可选的文化解释层：服务端重新计算并审计上下文，模型逐段引用允许的证据，不能修改命盘或补算强弱、喜忌和吉凶。未绑定真实记录的今日建议与旧年度静态解释接口仍主动停用。

真实排盘接口：`POST /api/v1/bazi/charts/calculate`；当前大运与流年接口：`POST /api/v1/bazi/context/current`。详细输入、规则和验证方式见 [`services/api/README.md`](services/api/README.md)。

欧美上线内部法务基线见 [`LEGAL_NOTICE.md`](LEGAL_NOTICE.md)，客户侧英文草案见 [`TERMS_OF_USE.md`](TERMS_OF_USE.md) 与 [`PRIVACY_NOTICE.md`](PRIVACY_NOTICE.md)。这些文件用于产品设计和律师交接，不替代美国、欧盟/欧洲经济区及英国执业律师的正式意见。

移动端：

```bash
cd apps/mobile
npm install
npm run start
```

Expo Go 可用于快速预览；`npm run android` 和 `npm run ios` 分别用于 Android / iOS 原生运行。Windows 可直接开发 Android，iOS 原生编译需要 macOS + Xcode。移动端 API 地址通过 `EXPO_PUBLIC_API_BASE_URL` 配置。
