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

## DeepSeek 个性化文化解读

`POST /api/v1/bazi/interpretations/generate` 会由服务端重新计算命盘与当前上下文，只有四柱、大运、流年和流月全部通过审计时才调用 DeepSeek。客户端不能提交一份自称“已计算”的事实来绕过核心引擎。

请求包含完整排盘输入、带偏移的 `as_of_utc`、语言、最多三个关注领域、可选问题，以及 `acknowledged_ai_processing: true`。发送给 DeepSeek 的不是原始出生资料，而是经过最小化的四柱/十神标签、当前周期、时间精度和审计事实包；出生日期、地点名、经纬度和 API Key 都不会进入移动客户端到模型的直接调用。

模型必须返回 JSON，每个解释段落必须引用服务端允许的 `evidence_ids`。未知证据、空内容、截断内容、危险确定性断言和无效结构会重试一次，仍不合格则返回可恢复的 `503 interpretation_output_rejected`；审计失败返回 `409 interpretation_context_not_audited`。检测到自伤或伤人信号时，在计算和模型调用前返回 `422 interpretation_safety_stop`。

后端环境变量：

- `DEEPSEEK_API_KEY`：必填密钥，只保存在后端秘密管理中。
- `DEEPSEEK_BASE_URL`：默认 `https://api.deepseek.com`，仅接受 HTTPS。
- `DEEPSEEK_MODEL`：默认 `deepseek-v4-flash`，可受控切换。
- `DEEPSEEK_TIMEOUT_SECONDS`：默认 30，限制为 5—60 秒。

## DeepSeek 现实反思对话

`POST /api/v1/reflections/conversation/turn` 是无服务端会话状态的多轮现实对话接口。客户端每轮提交当前事实、感受、解释、担心、最想确认的问题、最多四组既有问答，以及 `acknowledged_ai_processing: true`。接口不会读取命盘，也不会把现实内容和命盘文化解释自动混合。

默认首轮固定返回 `clarify`：模型必须先复述它听到的核心张力、明确标记一个暂时假设，并只追问一个会改变后续排序的关键问题。收到一次用户补充后，后续轮次固定返回 `synthesis`：必须包含 2–3 条不同路径、每条路径的适用条件和代价、一个小步骤及一个现实核对问题。用户也可显式请求 `response_mode: synthesize` 获取初步整理。

所有输出都必须引用服务端生成的 `entry.*` 或 `dialogue.user_*` 证据 ID；综合结果必须引用最新一次用户补充。未知证据、遗漏最新回复、非条件式假设、危险确定性语言、强迫性的重大决定指令和无效 JSON 会重试一次，仍不合格则返回 `503 reflection_output_rejected`。检测到自伤或他伤信号时，会在模型调用前返回 `422 reflection_safety_stop`。接口响应不缓存，生产环境不得记录请求正文。

旧的 `POST /api/v1/year-navigation/{year}` 静态解释骨架仍返回 `501 year_navigation_requires_chart_context`，防止旧客户端把静态季度或领域判断冒充为新个性化结果。

`POST /api/v1/daily/guidance/generate` 与 `GET /api/v1/daily/guidance/today` 同样会返回 `501 daily_guidance_requires_real_context`。只有用户真实记录、审计命盘和生成规则完成绑定后，今日建议功能才会重新开放。

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
- 时区数据：`tzdata==2026.3`；核心通过包内 TZif 文件加载，不读取 Linux/容器宿主机的系统时区库，版本写入 `rule_profile.timezone_database` 与计算哈希
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

## 官方黄金边界语料库

`tests/fixtures/solar_terms_2026_hko.json` 固化香港天文台公布的 2026 年节气分钟、双引擎审核后的秒级边界，以及每个“节”前后一秒的流月与流年柱。香港天文台注明其节气天文数据来自英国皇家航海年历办公室和美国海军天文台，时间采用 UTC+8。

测试要求全部十二个流月边界与官方分钟相差不超过 30 秒、两套历法引擎相差不超过 90 秒，并验证边界前一秒与边界当秒完成唯一交接。依赖升级若改变任何冻结秒值，必须先人工核对官方分钟再更新语料库，不能直接重录新结果。

## 真太阳时独立基准

`tests/fixtures/solar_time_2026_noaa.json` 固化 NOAA 在线太阳计算器在 GMT 12:00 的十二个全年代表值。核心的 Meeus 均时差实现必须与 NOAA 页面显示的 0.01 分钟精度一致；测试还独立实现 NOAA 公布的低阶年内角公式，在 1900—2100 年每月取样，允许该估算公式与精确路径最多相差 1.1 分钟。

真太阳时遵循 NOAA 公布的符号约定：东经为正，地方平太阳时为 `UTC + 4 × 经度`，相对当地民用时间的修正为 `4 × 经度 − UTC 偏移分钟`，地方视太阳时再加均时差。时区与夏令时只负责把出生地钟表时间还原为绝对时刻，不会重复叠加到经度修正；DST 回拨前后连续一分钟的真太阳时也必须连续一分钟。

NOAA 已注明在线计算器不再主动维护，因此它只作为外部回归基准，不是运行时依赖或唯一裁决来源。香港天文台关于平太阳时与视太阳时的定义作为第二官方概念来源。均时差函数拒绝没有时区的 `datetime`，避免结果暗中依赖服务器所在时区。

## 干支日与时柱独立基准

`tests/fixtures/sexagenary_days_2026_hko.json` 固化香港天文台 2026 年十二份官方月历中每月一日的干支，并记录天文台公布的六十甲子表、十二时辰范围和“日干起时干”表。自研日序以官方 `2026-01-01 = 乙亥` 为锚点，仅按连续公历日推进六十甲子，不调用 `lunar_python` 或 `sxtwl`。

每次排盘除原有双引擎核对外，还会执行 `day_pillar_cycle` 与 `hour_pillar_rule` 两项独立规则审计；任一不一致都令审计失败并停止展示结果。子时固定为 23:00—00:59 的连续时辰，时干在 23:00 段使用包含 00:00 的下一公历日干，因此 23:xx 与紧随其后的 00:xx 时柱连续；日柱是否在 23:00 提前换日仍由用户明确选择的 `day_boundary_rule` 控制。
