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
  "time_accuracy": "exact",
  "solar_time_mode": "civil",
  "day_boundary_rule": "midnight"
}
```

关键输入规则：

- `local_datetime` 是出生地钟表显示时间，不能附带 UTC 偏移。
- `iana_timezone` 用于还原历史 UTC 偏移和夏令时。
- `solar_time_mode` 支持 `civil`、`mean_solar`、`apparent_solar`。
- `day_boundary_rule` 支持午夜换日和晚子时换日。
- 夏令时结束造成重复时间时，必须通过 `dst_fold` 明确选择第一次或第二次。
- 当前经过交叉验证的出生年份范围为 1900—2100。

返回结果包含标准化时间、四柱及藏干/五行/十神/纳音、最近节气边界、时间误差备选、双引擎审计和确定性计算哈希。

## 出生地搜索

`GET /api/v1/locations/search?q=上海&language=zh&limit=6`

接口返回地点显示名、WGS84 经纬度和 IANA 时区，供排盘输入使用。默认 MVP 提供方为 Open-Meteo Geocoding，底层地点数据来自 GeoNames；生产商业环境应设置 `OPEN_METEO_API_KEY`，或通过 `ZHISHI_GEOCODING_URL` 指向已授权/自托管的兼容服务。地点服务失败时返回可恢复的 `503`，客户端仍允许手动填写时区和经度。

## 引擎与边界策略

- 主引擎：`lunar_python==1.4.8`
- 校验引擎：`sxtwl==2.0.7`
- 时区数据：`tzdata==2026.3`
- 年柱：立春精确交接时刻
- 月柱：十二节精确交接时刻
- 年/月按出生绝对时刻判断，日/时按所选当地时间模式判断
- `sxtwl` 在节气当天的直接年/月接口不参与裁决，改为校验其节气儒略日

## 确定性压力验算

```bash
.venv/Scripts/python scripts/verify_bazi.py --cases 1000 --seed 20260807
```

脚本覆盖上海、纽约、伦敦、东京和悉尼，并轮换三种时间模式与两种换日规则。任一双引擎检查失败时以非零状态退出。
