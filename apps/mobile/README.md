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

底部“命盘”入口已经连接真实 `zhishi-bazi-core`：用户填写出生日期、当地时间、IANA 时区与经度后，客户端会展示四柱、太阳时校正、最近节气边界、误差替代结果和双引擎审计状态。计算接口为 `POST /api/v1/bazi/charts/calculate`。

Windows 可以开发 Android / Expo Go；iOS 原生编译需要 macOS + Xcode。
