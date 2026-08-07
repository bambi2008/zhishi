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

底部“命盘”入口已经连接真实 `zhishi-bazi-core`：用户搜索出生城市即可自动填写 IANA 时区与经纬度，随后展示四柱、太阳时校正、最近节气边界、误差替代结果和双引擎审计状态。计算接口为 `POST /api/v1/bazi/charts/calculate`。

用户选择传统排运性别和起运算法后，结果会继续展示顺逆依据、起运年龄、起运日期以及八步大运时间轴。默认采用分钟折算法；传统天数/时辰折算法可显式切换，界面不会把流派差异隐藏在后台。

命盘不会自动持久化。用户点击“保存”后，出生资料和计算结果通过 AsyncStorage 保存在当前设备；这属于未加密设备存储，不应用于共享设备。后续接入账户同步时应改用服务端加密存储和明确的删除机制。

Windows 可以开发 Android / Expo Go；iOS 原生编译需要 macOS + Xcode。
