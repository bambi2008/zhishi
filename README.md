# 知时 · 东方人生导航 MVP

这是 Project ZHISHI 的第一轮可运行产品骨架，包含响应式 Web 原型、FastAPI API 骨架，以及面向 iOS / Android 的 Expo + React Native 移动端。

## 当前覆盖

- Daily / Journey / Year 三模式主导航
- 今日定向、今日行动和状态更新
- “我现在有点乱”三步澄清流程
- 人生章节时间线
- 一年导航年度总览、季度节奏、五个领域和月度导航
- 通用“为什么这么判断？”证据链展开
- 安全边界说明与本地演示数据
- FastAPI API 骨架：Onboarding、Daily、AnxietySession、Journey、Year
- 统一 EvidenceChain 结构和高风险安全分流
- React Native 移动端：Daily / Journey / Year、原生底部导航、原生弹层、API 健康状态连接

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

当前 API 使用内存存储和确定性演示逻辑，尚未接入真实账户、PostgreSQL、八字计算服务或模型 API。

移动端：

```bash
cd apps/mobile
npm install
npm run start
```

Expo Go 可用于快速预览；`npm run android` 和 `npm run ios` 分别用于 Android / iOS 原生运行。Windows 可直接开发 Android，iOS 原生编译需要 macOS + Xcode。移动端 API 地址通过 `EXPO_PUBLIC_API_BASE_URL` 配置。
