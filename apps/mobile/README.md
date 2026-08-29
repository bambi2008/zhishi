# 知时原生移动端

这是基于 Expo + React Native 的 iOS / Android 工程，和根目录的 Web MVP 共用产品语言，但不共用 Web DOM。

## 运行

```bash
npm install
npm run start
```

然后使用 Expo Go 扫码，或运行：

```bash
npm run android
npm run ios
```

如需连接本地 FastAPI，在 `.env` 中设置 `EXPO_PUBLIC_API_BASE_URL`。Android 模拟器通常使用 `http://10.0.2.2:8000`，iOS 模拟器使用 `http://127.0.0.1:8000`；真机需要改成电脑在局域网中的地址。

## TestFlight 准备

应用已配置 iOS bundle ID、构建号、无豁免加密声明、App 图标、启动图与 EAS 的 `preview` / `production` 构建档。任何 EAS 构建都会先执行生产环境检查，缺少 HTTPS API 地址时直接失败，避免上传一个只能访问 `127.0.0.1` 的无效版本。

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="https://<production-api-host>"
npm run testflight:check
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

第一次构建前仍需登录 Expo 与付费 Apple Developer 账号，由 EAS 创建/读取签名证书与 provisioning profile；App Store Connect 中也必须先建立与 `com.bambi2008.zhishi` 对应的应用记录。Apple 登录、2FA 和协议接受不能写入仓库。

底部“命盘”入口已经连接真实 `zhishi-bazi-core`：用户搜索出生城市即可自动填写 IANA 时区与经纬度，随后展示四柱、太阳时校正、最近节气边界、误差替代结果和双引擎审计状态。稳定命盘接口为 `POST /api/v1/bazi/charts/calculate`，带当前时刻的上下文接口为 `POST /api/v1/bazi/context/current`。

用户选择传统排运性别和起运算法后，结果会继续展示顺逆依据、起运年龄、起运日期、当前所在大运、当前立春流年、当前十二节流月、下一次交接时刻以及八步大运时间轴。默认采用分钟折算法；传统天数/时辰折算法可显式切换，界面不会把流派差异隐藏在后台。

出生时间精度可选择“精确”“约 ±30 分钟”或“约 ±60 分钟”。非精确输入仍按用户填写的具体时刻正常展示四柱、大运、流年和流月，同时保留误差区间候选；填写页和“安全与使用条款”会明确提醒实际出生时刻偏差可能改变结果。

“一年”页在全部计算审计通过后可请求 DeepSeek 个性化文化解读。用户先选择整体、事业与学习、关系或身心节奏，也可填写一个现实核对问题。每个 AI 段落都展示引用的确定性依据，并单独展示时间不确定提示和专业建议边界；生成结果只存在当前页面，不自动保存。App 不包含 DeepSeek API Key，全部模型调用由后端代理。

“我现在有点乱”会把用户填写的事实、感受、解释、担心和下一步问题分层展示。只有用户点击“保存这次梳理”后才通过 AsyncStorage 写入当前设备；保存后可在“章节”回看、逐条删除，也可从设置调用系统分享导出全部文字或统一清除。记录不会自动发送给知时 API 或 DeepSeek。

命盘不会自动持久化。用户点击“保存”后，出生资料和计算结果同样通过 AsyncStorage 保存在当前设备。命盘和事实梳理都属于应用沙盒内的未单独加密设备存储，不应用于共享设备；卸载 App、清除应用数据或主动删除后无法恢复。后续接入账户同步时应改用服务端加密存储和明确的删除机制。

出生资料提交前会显示美国与欧洲隐私基线提示：当前 MVP 的计算 API 不主动持久化请求，不销售数据、不投放行为广告；命盘和事实梳理仅在用户主动点击保存后写入本机。AI 解读按钮另有即时披露，说明最小化事实包和可选问题将发送给 DeepSeek。完整欧美上线草案见根目录 `TERMS_OF_USE.md`、`PRIVACY_NOTICE.md` 和内部 `LEGAL_NOTICE.md`。

Windows 可以开发 Android / Expo Go；iOS 原生编译需要 macOS + Xcode。
