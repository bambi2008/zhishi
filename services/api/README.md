# zhishi API

## 安装与测试

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[test]"
.venv/Scripts/python -m pytest -q
```

Windows 之外请将 `.venv/Scripts/python` 替换为 `.venv/bin/python`。

## 真实四柱计算

`POST /api/v1/bazi/charts/calculate`

```json
{
  "local_datetime": "2005-12-23T08:37:00",
  "iana_timezone": "Asia/Shanghai",
  "longitude": 121.4737,
  "latitude": 31.2304,
  "birth_location_name": "上海",
  "gender": "male",
  "time_accuracy": "exact",
  "solar_time_mode": "civil",
  "day_boundary_rule": "midnight",
  "luck_start_rule": "precise_minutes"
}
```

关键输入规则：

- `local_datetime` 是出生地钟表显示时间，不能附带 UTC 偏移。
- `time_accuracy` 支持 `exact`、`approximate` 和 `hour_only`，默认误差分别为 ±1、±30、±60 分钟；也可用 `uncertainty_minutes` 显式指定 0—120 分钟。
- `iana_timezone` 用于还原历史 UTC 偏移和夏令时。
- `solar_time_mode` 支持 `civil`、`mean_solar`、`apparent_solar`。
- `day_boundary_rule` 支持午夜换日和晚子时换日。
- `gender` 只用于传统大运顺逆：阳年男、阴年女顺行，阴年男、阳年女逆行。也可由受控调用方通过 `luck_direction_override` 显式覆盖。
- `luck_start_rule` 支持 `precise_minutes`（分钟折算，默认）和 `traditional_segments`（三天一岁、一天四月、一时辰十天）。两者都只数前后“节”，不数“气”。
- 夏令时结束造成重复时间时，必须通过 `dst_fold` 明确选择第一次或第二次。
- 当前经过交叉验证的出生年份范围为 1900—2100。

返回结果包含标准化时间、四柱及藏干/五行/十神/纳音、最近节气边界、时间误差备选、大运顺逆/起运时刻/八步运柱、双引擎审计和确定性计算哈希。大运同时核对 `lunar_python`、自研折算公式和 `sxtwl` 节气时刻；任一检查失败时停止展示大运，但不影响已经独立通过的四柱。

非精确出生时间仍按用户填写的具体时刻正常计算并展示四柱、大运、流年和流月；四柱同时返回误差区间端点的候选差异，供客户端提醒用户理解输入误差。计算结果保持完整审计，客户端和使用条款必须明确说明实际出生时刻偏差可能改变结果。

## 当前大运与流年

`POST /api/v1/bazi/context/current`

```json
{
  "chart": {
    "local_datetime": "2005-12-23T08:37:00",
    "iana_timezone": "Asia/Shanghai",
    "longitude": 121.4737,
    "gender": "male",
    "solar_time_mode": "civil",
    "day_boundary_rule": "midnight"
  },
  "as_of_utc": "2026-08-07T00:00:00Z"
}
```

`as_of_utc` 必须带 UTC 偏移，避免服务器时区造成隐式变化。接口一次返回稳定命盘、当前所在大运、下一步大运及交接时刻、当前流年与前后两个精确立春边界，以及当前流月与前后两个精确“节”边界。当前状态不写入命盘计算哈希；同一输入和同一 `as_of_utc` 可复现同一结果。流年核对主引擎年柱、1984 甲子基准公式及 `sxtwl` 立春时刻；流月核对主引擎月柱、五虎遁公式及 `sxtwl` 节气时刻。任一审计失败时停止展示当前周期。

## 出生地搜索

`POST /api/v1/locations/search`

```json
{
  "query": "上海",
  "language": "zh",
  "limit": 6
}
```

接口返回地点显示名、WGS84 经纬度和 IANA 时区，供排盘输入使用。默认 MVP 提供方为 Open-Meteo Geocoding，底层地点数据来自 GeoNames；生产商业环境应设置 `OPEN_METEO_API_KEY`，或通过 `ZHISHI_GEOCODING_URL` 指向已授权/自托管的兼容服务。地点服务失败时返回可恢复的 `503`，客户端仍允许手动填写时区和经度。

地点搜索词只放在 POST 请求体中，不进入 URL 查询字符串，避免普通访问日志记录出生地点。所有 `/api/v1/` 响应（包括错误和预检响应）均发送 `Cache-Control: no-store`；生产环境不得开启请求体日志。Web 客户端的精确可信来源通过逗号分隔的 `ZHISHI_CORS_ORIGINS` 配置，不接受 `*` 通配符；原生 iOS/Android 客户端不依赖浏览器 CORS。

## 引擎与边界策略

- 主引擎：`lunar_python==1.4.8`
- 校验引擎：`sxtwl==2.0.7`
- 时区数据：`tzdata==2026.3`
- 年柱：立春精确交接时刻
- 月柱：十二节精确交接时刻
- 年/月按出生绝对时刻判断，日/时按所选当地时间模式判断
- `sxtwl` 在节气当天的直接年/月接口不参与裁决，改为校验其节气儒略日
- 流年按精确立春时刻切换，不按公历元旦或立春整日切换
- 流月按立春、惊蛰、清明等十二“节”的精确时刻切换，不按公历月初切换

## 确定性压力验算

```bash
.venv/Scripts/python scripts/verify_bazi.py --cases 1000 --seed 20260807
```

脚本覆盖上海、纽约、伦敦、东京和悉尼，并轮换三种时间模式、两种换日规则、两种起运算法、男女顺逆及精确/非精确出生时间；随机 `as_of_utc` 同时覆盖起运前、运中和八步运后。任一四柱、大运、立春流年、十二节流月审计失败，或非精确输入未能正常返回可见周期时，以非零状态退出。
