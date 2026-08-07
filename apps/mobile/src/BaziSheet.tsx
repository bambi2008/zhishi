import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  BaziCalculationInput,
  BaziCalculationResult,
  BaziCurrentContextResult,
  BaziGender,
  BaziTimeAccuracy,
  DayBoundaryRule,
  LocationSearchResult,
  LuckStartRule,
  SolarTimeMode,
  ZhishiApiError,
  calculateBaziCurrentContext,
  searchBirthLocations,
} from './api';
import {
  clearStoredBaziChart,
  loadStoredBaziChart,
  saveStoredBaziChart,
} from './chartStorage';


const colors = {
  paper: '#F9F8F3',
  card: '#FFFEFA',
  ink: '#252927',
  muted: '#7D817B',
  line: 'rgba(43,48,43,0.12)',
  sage: '#586D54',
  sageSoft: '#E8EEE4',
  terracotta: '#C77A59',
  warning: '#FAF2E8',
};

const solarModes: Array<[SolarTimeMode, string]> = [
  ['civil', '标准时'],
  ['mean_solar', '平太阳时'],
  ['apparent_solar', '真太阳时'],
];

const dayRules: Array<[DayBoundaryRule, string]> = [
  ['midnight', '午夜换日'],
  ['late_zi_next_day', '晚子时换日'],
];

const genderOptions: Array<[BaziGender | '', string]> = [
  ['male', '男'],
  ['female', '女'],
];

const luckStartRules: Array<[LuckStartRule, string]> = [
  ['precise_minutes', '分钟精算'],
  ['traditional_segments', '传统折算'],
];

const timeAccuracyOptions: Array<[BaziTimeAccuracy, string]> = [
  ['exact', '精确'],
  ['approximate', '约 ±30 分'],
  ['hour_only', '约 ±60 分'],
];

const dstFoldOptions: Array<[0 | 1, string]> = [
  [0, '第一次出现'],
  [1, '第二次出现'],
];

function validLocalDateTime(date: string, time: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return false;
  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && hour >= 0 && hour <= 23
    && minute >= 0 && minute <= 59;
}

function formatCorrection(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} 分钟`;
}

function formatSelectedTime(value: string): string {
  return value.replace('T', ' ').slice(0, 16);
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '已保存' : `保存于 ${date.toLocaleString('zh-CN')}`;
}

function formatLuckAge(age: { years: number; months: number; days: number; hours: number }): string {
  return `${age.years} 年 ${age.months} 月 ${age.days} 日 ${age.hours} 时`;
}

function formatLuckDate(value: string): string {
  return value.replace('T', ' ').slice(0, 16);
}

function formatBeijingInstant(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function PillarCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.pillarCard}><Text style={styles.pillarLabel}>{label}</Text><Text style={styles.pillarValue}>{value}</Text><Text style={styles.pillarDetail}>{detail}</Text></View>;
}

function LuckCycleView({ result, currentContext, contextLoading }: { result: BaziCalculationResult; currentContext: BaziCurrentContextResult | null; contextLoading: boolean }) {
  const luck = result.luck_cycles;
  if (!luck) return null;
  if (!luck.user_visible) {
    return <View style={styles.warningCard}><Text style={styles.warningTitle}>大运校验未通过</Text><Text style={styles.warningText}>大运结果已停止展示，四柱仍可独立查看。</Text></View>;
  }
  const current = currentContext?.current_luck;
  const activeIndex = current?.current_period?.index;
  return <View style={styles.luckWrap}>
    <View style={styles.luckHeader}><View><Text style={styles.eyebrow}>三路规则审计通过</Text><Text style={styles.luckTitle}>大运时间轴</Text></View><View style={styles.directionChip}><Text style={styles.directionText}>{luck.direction === 'forward' ? '顺行' : '逆行'}</Text></View></View>
    <View style={styles.luckStartCard}><Text style={styles.factTitle}>起运</Text><Text style={styles.luckStartValue}>{formatLuckAge(luck.start_age)}后</Text><Text style={styles.factText}>{formatLuckDate(luck.start_at_local)} · {luck.direction_basis}</Text><Text style={styles.factText}>取 {luck.start_boundary.name} 精确时刻 · {luck.start_rule === 'precise_minutes' ? '分钟折算法' : '天数/时辰折算法'}</Text></View>
    {contextLoading ? <View style={styles.currentCycleCard}><View style={styles.contextLoadingRow}><ActivityIndicator size="small" color={colors.sage} /><Text style={styles.factText}>正在定位当前大运与流年…</Text></View></View> : null}
    {!contextLoading && currentContext?.user_visible ? <View style={styles.currentCycleCard}>
      <Text style={styles.currentCycleEyebrow}>截至现在 · 精确边界已校验</Text>
      {current?.status === 'active' && current.current_period ? <>
        <Text style={styles.currentCycleValue}>第 {current.current_period.index} 运 · {current.current_period.pillar.value}</Text>
        <Text style={styles.currentCycleMeta}>{current.current_period.start_at_local.slice(0, 10)} — {current.current_period.end_at_local_exclusive.slice(0, 10)}（出生地时间）</Text>
      </> : current?.status === 'pre_luck' ? <><Text style={styles.currentCycleValue}>尚未起运</Text><Text style={styles.currentCycleMeta}>{current.next_transition_local?.slice(0, 16).replace('T', ' ')} 起进入第 1 运</Text></> : <Text style={styles.currentCycleValue}>当前时刻超出八步大运范围</Text>}
      <View style={styles.annualRow}><View><Text style={styles.factTitle}>当前流年</Text><Text style={styles.annualValue}>{currentContext.annual_cycle.label_year} · {currentContext.annual_cycle.pillar.value}</Text></View><View style={styles.annualBoundary}><Text style={styles.factTitle}>下次流年交接</Text><Text style={styles.annualBoundaryValue}>{formatBeijingInstant(currentContext.annual_cycle.end_boundary.boundary_time_utc)}</Text><Text style={styles.annualBoundaryLabel}>北京时间 · 立春</Text></View></View>
      <View style={styles.monthlyRow}><View><Text style={styles.factTitle}>当前流月</Text><Text style={styles.annualValue}>{currentContext.monthly_cycle.pillar.value}</Text><Text style={styles.annualBoundaryLabel}>{currentContext.monthly_cycle.start_boundary.name}起 · 第 {currentContext.monthly_cycle.sequence_from_lichun} 月</Text></View><View style={styles.annualBoundary}><Text style={styles.factTitle}>下次流月交接</Text><Text style={styles.annualBoundaryValue}>{formatBeijingInstant(currentContext.monthly_cycle.end_boundary.boundary_time_utc)}</Text><Text style={styles.annualBoundaryLabel}>北京时间 · {currentContext.monthly_cycle.end_boundary.name}</Text></View></View>
    </View> : null}
    {!contextLoading && currentContext && !currentContext.user_visible ? <View style={styles.warningCard}><Text style={styles.warningTitle}>当前周期校验未通过</Text><Text style={styles.warningText}>当前大运与流年已停止展示，原始命盘仍保持不变。</Text></View> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.luckPeriods} nestedScrollEnabled>
      {luck.periods.map(period => <View key={period.index} style={[styles.luckPeriodCard, activeIndex === period.index && styles.luckPeriodActive]}>{activeIndex === period.index ? <Text style={styles.currentTag}>当前</Text> : null}<Text style={styles.luckIndex}>第 {period.index} 运</Text><Text style={styles.luckPillar}>{period.pillar.value}</Text><Text style={styles.luckTenGod}>{period.pillar.stem_ten_god}</Text><View style={styles.luckDivider} /><Text style={styles.luckAge}>{period.start_age.years} 岁起</Text><Text style={styles.luckDate}>{period.start_at_local.slice(0, 10)}</Text></View>)}
    </ScrollView>
    <Text style={styles.luckMeta}>{luck.audit.primary_engine} × {luck.audit.verification_engine}</Text>
  </View>;
}

function ResultView({ result, currentContext, contextLoading }: { result: BaziCalculationResult; currentContext: BaziCurrentContextResult | null; contextLoading: boolean }) {
  const pillars = [
    ['年柱', result.pillars.year],
    ['月柱', result.pillars.month],
    ['日柱', result.pillars.day],
    ['时柱', result.pillars.hour],
  ] as const;
  const nearestMinutes = Math.abs(result.boundary.nearest_jie.distance_seconds / 60);

  return <View style={styles.resultWrap}>
    <View style={styles.resultHeader}><View><Text style={styles.eyebrow}>已完成双引擎校验</Text><Text style={styles.resultTitle}>你的四柱底图</Text></View><View style={[styles.auditChip, result.audit.status === 'failed' && styles.auditFailed]}><Text style={styles.auditText}>{result.audit.status === 'passed' ? '校验通过' : '校验失败'}</Text></View></View>
    <View style={styles.pillarRow}>{pillars.map(([label, pillar]) => <PillarCard key={label} label={label} value={pillar.value} detail={`${pillar.stem_element} · ${pillar.branch_element}`} />)}</View>
    <View style={styles.factCard}>
      <Text style={styles.factTitle}>时间校正</Text>
      <Text style={styles.factValue}>{formatCorrection(result.normalized_times.total_apparent_correction_minutes)}</Text>
      <Text style={styles.factText}>真太阳时 {formatSelectedTime(result.normalized_times.apparent_solar_time)} · 本次采用 {solarModes.find(([mode]) => mode === result.normalized_times.selected_mode)?.[1]}</Text>
    </View>
    <View style={styles.factCard}>
      <Text style={styles.factTitle}>最近节气边界</Text>
      <Text style={styles.factValue}>{result.boundary.nearest_jie.name} · 相距 {nearestMinutes.toFixed(nearestMinutes < 10 ? 1 : 0)} 分钟</Text>
      <Text style={styles.factText}>年柱按立春、月柱按十二节的精确交接时刻判断。</Text>
    </View>
    {result.boundary.risk !== 'none' && <View style={styles.warningCard}><Text style={styles.warningTitle}>边界提醒</Text>{result.boundary.notes.map(note => <Text key={note} style={styles.warningText}>• {note}</Text>)}</View>}
    {result.alternatives.length > 0 && <View style={styles.alternativeCard}><Text style={styles.factTitle}>出生时间误差可能产生的结果</Text>{result.alternatives.map(item => <Text key={item.label} style={styles.alternativeText}>{item.label === 'earliest' ? '最早' : '最晚'}：{item.year} {item.month} {item.day} {item.hour}</Text>)}</View>}
    <LuckCycleView result={result} currentContext={currentContext} contextLoading={contextLoading} />
    <Text style={styles.engineMeta}>{result.audit.primary_engine} × {result.audit.verification_engine} · {result.rule_profile.timezone_database} · {result.calculation_hash.slice(0, 12)}</Text>
  </View>;
}

export function BaziSheet({ onClose }: { onClose: () => void }) {
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [timezone, setTimezone] = useState('');
  const [longitude, setLongitude] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [resolvedLocationName, setResolvedLocationName] = useState('');
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [solarMode, setSolarMode] = useState<SolarTimeMode>('civil');
  const [dayRule, setDayRule] = useState<DayBoundaryRule>('midnight');
  const [gender, setGender] = useState<BaziGender | ''>('');
  const [luckStartRule, setLuckStartRule] = useState<LuckStartRule>('precise_minutes');
  const [timeAccuracy, setTimeAccuracy] = useState<BaziTimeAccuracy>('exact');
  const [dstFold, setDstFold] = useState<0 | 1 | undefined>(undefined);
  const [dstFoldRequired, setDstFoldRequired] = useState(false);
  const [result, setResult] = useState<BaziCalculationResult | null>(null);
  const [currentContext, setCurrentContext] = useState<BaziCurrentContextResult | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [lastInput, setLastInput] = useState<BaziCalculationInput | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetDstFold = () => {
    setDstFold(undefined);
    setDstFoldRequired(false);
  };

  const changeBirthDate = (value: string) => {
    setBirthDate(value);
    resetDstFold();
  };

  const changeBirthTime = (value: string) => {
    setBirthTime(value);
    resetDstFold();
  };

  const changeTimezone = (value: string) => {
    setTimezone(value);
    resetDstFold();
  };

  useEffect(() => {
    let active = true;
    loadStoredBaziChart().then(stored => {
      if (!active || !stored) return;
      const [datePart, timePart = ''] = stored.input.local_datetime.split('T');
      setBirthDate(datePart);
      setBirthTime(timePart.slice(0, 5));
      setLocationName(stored.input.birth_location_name ?? '');
      setResolvedLocationName(stored.input.birth_location_name ?? '');
      setTimezone(stored.input.iana_timezone);
      setLongitude(String(stored.input.longitude));
      setLatitude(stored.input.latitude ?? null);
      setSolarMode(stored.input.solar_time_mode);
      setDayRule(stored.input.day_boundary_rule);
      setGender(stored.input.gender ?? '');
      setLuckStartRule(stored.input.luck_start_rule ?? 'precise_minutes');
      setTimeAccuracy(stored.input.time_accuracy ?? 'exact');
      setDstFold(stored.input.dst_fold);
      setDstFoldRequired(false);
      setLastInput(stored.input);
      setResult(stored.result);
      setSavedAt(stored.saved_at);
      if (stored.input.gender || stored.input.luck_direction_override) {
        setContextLoading(true);
        calculateBaziCurrentContext(stored.input).then(context => {
          if (active) setCurrentContext(context);
        }).catch(() => {
          if (active) setCurrentContext(null);
        }).finally(() => {
          if (active) setContextLoading(false);
        });
      }
    }).catch(() => {
      if (active) setStorageMessage('无法读取本机保存的命盘。');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = locationName.trim();
    if (query.length < 2 || query === resolvedLocationName) {
      setLocationResults([]);
      setLocationSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLocationSearching(true);
      setLocationMessage('');
      searchBirthLocations(query, controller.signal).then(items => {
        setLocationResults(items);
        if (items.length === 0) setLocationMessage('没有找到匹配地点，可继续手动填写时区和经度。');
      }).catch(searchError => {
        if (searchError instanceof Error && searchError.name === 'AbortError') return;
        setLocationResults([]);
        setLocationMessage('地点搜索暂时不可用，可继续手动填写时区和经度。');
      }).finally(() => setLocationSearching(false));
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationName, resolvedLocationName]);

  const changeLocationName = (value: string) => {
    setLocationName(value);
    if (value !== resolvedLocationName) {
      setResolvedLocationName('');
      setLatitude(null);
    }
  };

  const chooseLocation = (item: LocationSearchResult) => {
    setLocationName(item.display_name);
    setResolvedLocationName(item.display_name);
    setTimezone(item.iana_timezone);
    setLongitude(String(item.longitude));
    setLatitude(item.latitude);
    setDstFold(undefined);
    setDstFoldRequired(false);
    setLocationResults([]);
    setLocationMessage(`已识别 ${item.iana_timezone} · 经度 ${item.longitude.toFixed(4)}°`);
  };

  const submit = async () => {
    setError('');
    if (!validLocalDateTime(birthDate, birthTime)) {
      setError('请按 YYYY-MM-DD 和 HH:mm 填写有效的出生日期与时间。');
      return;
    }
    const longitudeValue = Number(longitude);
    if (!Number.isFinite(longitudeValue) || longitudeValue < -180 || longitudeValue > 180) {
      setError('请填写 -180 到 180 之间的出生地经度。');
      return;
    }
    if (!timezone.includes('/')) {
      setError('请填写 IANA 时区，例如 Asia/Shanghai。');
      return;
    }
    if (!gender) {
      setError('请选择传统排运性别；该字段只用于计算大运顺逆。');
      return;
    }
    if (dstFoldRequired && dstFold === undefined) {
      setError('请选择这个重复钟表时间是第一次出现还是第二次出现。');
      return;
    }

    setLoading(true);
    setContextLoading(true);
    try {
      const calculationInput: BaziCalculationInput = {
        local_datetime: `${birthDate}T${birthTime}:00`,
        iana_timezone: timezone.trim(),
        longitude: longitudeValue,
        latitude: latitude ?? undefined,
        birth_location_name: locationName.trim(),
        gender,
        luck_start_rule: luckStartRule,
        time_accuracy: timeAccuracy,
        dst_fold: dstFold,
        solar_time_mode: solarMode,
        day_boundary_rule: dayRule,
      };
      const context = await calculateBaziCurrentContext(calculationInput);
      const chart = context.chart;
      setLastInput(calculationInput);
      setResult(chart);
      setCurrentContext(context);
      setSavedAt(null);
      setStorageMessage('');
      setDstFoldRequired(false);
      if (!chart.user_visible) setError('双引擎校验未通过，本次结果已停止展示。');
    } catch (requestError) {
      setResult(null);
      setCurrentContext(null);
      if (requestError instanceof ZhishiApiError && requestError.code === 'ambiguous_local_time') {
        setDstFoldRequired(true);
        setError('这个出生地钟表时间因夏令时结束出现了两次。请选择第一次或第二次后重新排盘；系统不会替你猜。');
      } else {
        setError(requestError instanceof Error ? requestError.message : '排盘失败，请稍后重试。');
      }
    } finally {
      setLoading(false);
      setContextLoading(false);
    }
  };

  const saveChart = async () => {
    if (!result || !lastInput) return;
    try {
      const stored = await saveStoredBaziChart(lastInput, result);
      setSavedAt(stored.saved_at);
      setStorageMessage('已保存在这台设备。');
    } catch {
      setStorageMessage('保存失败，请检查设备存储权限后重试。');
    }
  };

  const clearSavedChart = async () => {
    try {
      await clearStoredBaziChart();
      setSavedAt(null);
      setStorageMessage('已清除本机保存；当前结果仍可查看。');
    } catch {
      setStorageMessage('清除失败，请稍后重试。');
    }
  };

  return <View style={styles.sheet}>
    <View style={styles.sheetHeader}><View><Text style={styles.sheetHeaderTitle}>我的命盘</Text><Text style={styles.sheetHeaderMeta}>真实历法 · 可追溯计算</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭命盘"><Text style={styles.closeText}>×</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>出生资料</Text><Text style={styles.title}>先把时间算对，再谈解释。</Text><Text style={styles.subtitle}>出生时间按当地钟表填写。系统会处理历史时区、经度、均时差和节气边界。</Text>
      <View style={styles.twoColumns}><Field label="出生日期" value={birthDate} onChangeText={changeBirthDate} placeholder="1990-06-15" /><Field label="出生时间" value={birthTime} onChangeText={changeBirthTime} placeholder="23:30" /></View>
      <Segmented label="出生时间精度" options={timeAccuracyOptions} value={timeAccuracy} onChange={setTimeAccuracy} />
      <Text style={styles.ruleHint}>请按你掌握的情况选择。即使时间不确定，系统仍会按所填时刻正常计算，并提示误差范围内可能出现的候选差异。</Text>
      {timeAccuracy !== 'exact' ? <View style={styles.inputNoticeCard}><Text style={styles.inputNoticeTitle}>请确认：结果仍按你填写的时刻计算</Text><Text style={styles.inputNoticeText}>实际出生时刻若与填写值有偏差，四柱、大运、流年和流月都可能变化。请结合你掌握的资料理解结果。</Text></View> : null}
      <Field label="出生地" value={locationName} onChangeText={changeLocationName} placeholder="输入城市，例如：上海 / Vancouver" autoCapitalize="none" />
      {locationSearching ? <View style={styles.locationStatus}><ActivityIndicator size="small" color={colors.sage} /><Text style={styles.locationStatusText}>正在识别时区与经纬度…</Text></View> : null}
      {locationResults.length > 0 ? <View style={styles.locationResults}>{locationResults.map(item => <Pressable key={item.provider_id} onPress={() => chooseLocation(item)} style={({ pressed }) => [styles.locationResult, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={styles.locationName}>{item.display_name}</Text><Text style={styles.locationMeta}>{item.iana_timezone} · {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text></View><Text style={styles.locationArrow}>→</Text></Pressable>)}<Text style={styles.attribution}>地点数据：Open-Meteo / GeoNames</Text></View> : null}
      {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}
      <View style={styles.twoColumns}><Field label="IANA 时区" value={timezone} onChangeText={changeTimezone} placeholder="Asia/Shanghai" autoCapitalize="none" /><Field label="出生地经度" value={longitude} onChangeText={setLongitude} placeholder="121.4737" autoCapitalize="none" /></View>
      <Text style={styles.fieldHint}>选择搜索结果后自动填写；也可手动修改。东经为正，西经为负。</Text>
      {dstFoldRequired || dstFold !== undefined ? <View style={styles.dstFoldCard}><Text style={styles.dstFoldTitle}>这个钟表时间出现了两次</Text><Text style={styles.dstFoldText}>夏令时结束时，同一个当地时间可能对应两个真实时刻。请根据出生记录选择；第一次对应较早的绝对时刻，第二次对应较晚的绝对时刻。</Text><View style={styles.segmentRow}>{dstFoldOptions.map(([value, label]) => <Pressable key={value} onPress={() => { setDstFold(value); setError(''); }} style={[styles.segment, dstFold === value && styles.segmentActive]}><Text style={[styles.segmentText, dstFold === value && styles.segmentTextActive]}>{label}</Text></Pressable>)}</View>{dstFold !== undefined ? <Text style={styles.dstFoldSelected}>已选择{dstFold === 0 ? '第一次' : '第二次'}；可重新排盘或切换选择。</Text> : null}</View> : null}
      <Segmented label="时间模式" options={solarModes} value={solarMode} onChange={setSolarMode} />
      <Segmented label="换日规则" options={dayRules} value={dayRule} onChange={setDayRule} />
      <Segmented label="传统排运性别" options={genderOptions} value={gender} onChange={setGender} />
      <Text style={styles.ruleHint}>仅用于“阳年男/阴年女顺，阴年男/阳年女逆”的传统排运规则，不用于判断性别身份。</Text>
      <Segmented label="起运算法" options={luckStartRules} value={luckStartRule} onChange={setLuckStartRule} />
      <View style={styles.inputNoticeCard}><Text style={styles.inputNoticeTitle}>提交前隐私提示</Text><Text style={styles.inputNoticeText}>点击排盘后，出生资料会发送到配置的计算 API。当前 MVP 不主动保存计算请求，也不销售数据或用于行为广告；只有你主动点击“保存”后，命盘才会写入本机。请仅填写本人或已获授权的资料。</Text></View>
      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
      <Pressable disabled={loading} onPress={submit} style={({ pressed }) => [styles.calculateButton, pressed && styles.pressed, loading && styles.disabled]}>{loading ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.calculateText}>{result ? '重新计算' : '开始排盘'}</Text><Text style={styles.calculateArrow}>→</Text></>}</Pressable>
      {result?.user_visible ? <><ResultView result={result} currentContext={currentContext} contextLoading={contextLoading} /><View style={styles.storageCard}><View style={{ flex: 1 }}><Text style={styles.storageTitle}>{savedAt ? '命盘已保存在本机' : '保存这张命盘'}</Text><Text style={styles.storageText}>{savedAt ? formatSavedAt(savedAt) : '仅在你明确操作后保存；数据不会自动上传账户。'}</Text>{storageMessage ? <Text style={styles.storageMessage}>{storageMessage}</Text> : null}</View><Pressable onPress={savedAt ? clearSavedChart : saveChart} style={styles.storageButton}><Text style={styles.storageButtonText}>{savedAt ? '清除' : '保存'}</Text></Pressable></View></> : null}
      <Text style={styles.disclaimer}>排盘依据你提交的出生日期、时间、地点和规则选项生成。出生时间不准确可能改变结果；非精确时间仍会正常计算。命盘属于传统文化参考，不替代医疗、法律、财务或其他专业判断。详见“安全、隐私与使用条款”。</Text>
    </ScrollView>
  </View>;
}

function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; autoCapitalize?: 'none' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor="#AAADA5" style={styles.input} /></View>;
}

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return <View style={styles.segmentWrap}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.segmentRow}>{options.map(([key, text]) => <Pressable key={key} onPress={() => onChange(key)} style={[styles.segment, value === key && styles.segmentActive]}><Text style={[styles.segmentText, value === key && styles.segmentTextActive]}>{text}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '96%', backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 18 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  sheetHeaderTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  sheetHeaderMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  closeText: { color: '#989C92', fontSize: 27, lineHeight: 27, paddingHorizontal: 5 },
  content: { paddingBottom: 18 },
  eyebrow: { color: colors.sage, fontSize: 9, letterSpacing: 1.1, marginTop: 5 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '600', lineHeight: 33, marginTop: 11 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 8, marginBottom: 18 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, marginBottom: 13 },
  fieldLabel: { color: '#737970', fontSize: 10, marginBottom: 7 },
  input: { minHeight: 44, borderWidth: 1, borderColor: 'rgba(43,48,43,0.16)', borderRadius: 11, paddingHorizontal: 12, color: colors.ink, backgroundColor: colors.card, fontSize: 12 },
  fieldHint: { color: '#989B94', fontSize: 9, lineHeight: 15, marginTop: -6, marginBottom: 15 },
  ruleHint: { color: '#989B94', fontSize: 8, lineHeight: 14, marginTop: -8, marginBottom: 14 },
  inputNoticeCard: { borderWidth: 1, borderColor: '#E7D3C5', borderRadius: 11, backgroundColor: colors.warning, padding: 12, marginTop: -4, marginBottom: 14 },
  inputNoticeTitle: { color: colors.terracotta, fontSize: 10, fontWeight: '700' },
  inputNoticeText: { color: '#816F5E', fontSize: 9, lineHeight: 15, marginTop: 5 },
  dstFoldCard: { borderWidth: 1, borderColor: '#D8B897', borderRadius: 11, backgroundColor: '#FFF7EC', padding: 12, marginBottom: 15 },
  dstFoldTitle: { color: colors.terracotta, fontSize: 11, fontWeight: '700' },
  dstFoldText: { color: '#816F5E', fontSize: 9, lineHeight: 15, marginTop: 5, marginBottom: 10 },
  dstFoldSelected: { color: colors.sage, fontSize: 9, lineHeight: 14, marginTop: 8 },
  locationStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4, marginBottom: 12 },
  locationStatusText: { color: colors.muted, fontSize: 9 },
  locationResults: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden', marginTop: -5, marginBottom: 13 },
  locationResult: { minHeight: 54, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationName: { color: colors.ink, fontSize: 11, fontWeight: '600' },
  locationMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
  locationArrow: { color: colors.sage, fontSize: 15 },
  attribution: { color: '#A1A39B', fontSize: 7, paddingHorizontal: 12, paddingVertical: 7 },
  locationMessage: { color: colors.sage, fontSize: 9, lineHeight: 15, marginTop: -5, marginBottom: 13 },
  segmentWrap: { marginBottom: 15 },
  segmentRow: { flexDirection: 'row', gap: 7 },
  segment: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: 5 },
  segmentActive: { borderColor: '#C9D7C4', backgroundColor: colors.sageSoft },
  segmentText: { color: colors.muted, fontSize: 10 },
  segmentTextActive: { color: colors.sage, fontWeight: '600' },
  calculateButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.ink, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  calculateText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  calculateArrow: { color: '#FFF', fontSize: 17 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.62 },
  errorCard: { backgroundColor: '#F8E9E4', borderRadius: 10, padding: 12, marginBottom: 10 },
  errorText: { color: '#9C543E', fontSize: 10, lineHeight: 16 },
  resultWrap: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 22 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTitle: { color: colors.ink, fontSize: 21, fontWeight: '600', marginTop: 7 },
  auditChip: { borderRadius: 99, backgroundColor: colors.sageSoft, paddingHorizontal: 10, paddingVertical: 7 },
  auditFailed: { backgroundColor: '#F8E9E4' },
  auditText: { color: colors.sage, fontSize: 9, fontWeight: '600' },
  pillarRow: { flexDirection: 'row', gap: 7, marginTop: 17 },
  pillarCard: { flex: 1, minHeight: 108, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 3 },
  pillarLabel: { color: colors.muted, fontSize: 8 },
  pillarValue: { color: colors.ink, fontSize: 20, fontWeight: '600', lineHeight: 29, marginTop: 9 },
  pillarDetail: { color: colors.sage, fontSize: 8, marginTop: 5 },
  factCard: { borderRadius: 12, backgroundColor: '#F0F0E9', padding: 13, marginTop: 10 },
  factTitle: { color: colors.muted, fontSize: 9 },
  factValue: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 7 },
  factText: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 6 },
  warningCard: { borderRadius: 12, backgroundColor: colors.warning, padding: 13, marginTop: 10 },
  warningTitle: { color: colors.terracotta, fontSize: 10, fontWeight: '600' },
  warningText: { color: '#816F5E', fontSize: 9, lineHeight: 15, marginTop: 5 },
  alternativeCard: { borderWidth: 1, borderColor: '#E7D3C5', borderRadius: 12, padding: 13, marginTop: 10 },
  alternativeText: { color: colors.ink, fontSize: 10, marginTop: 8 },
  luckWrap: { marginTop: 22, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 20 },
  luckHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  luckTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginTop: 7 },
  directionChip: { borderRadius: 99, backgroundColor: '#FAF2E8', paddingHorizontal: 11, paddingVertical: 7 },
  directionText: { color: colors.terracotta, fontSize: 9, fontWeight: '700' },
  luckStartCard: { borderRadius: 12, backgroundColor: colors.sageSoft, padding: 13, marginTop: 14 },
  luckStartValue: { color: colors.ink, fontSize: 15, fontWeight: '600', marginTop: 7 },
  currentCycleCard: { borderRadius: 13, backgroundColor: '#F3E9DF', padding: 14, marginTop: 10 },
  currentCycleEyebrow: { color: colors.terracotta, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  currentCycleValue: { color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 8 },
  currentCycleMeta: { color: colors.muted, fontSize: 8, marginTop: 5 },
  contextLoadingRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  annualRow: { borderTopWidth: 1, borderTopColor: 'rgba(199,122,89,0.18)', marginTop: 13, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  monthlyRow: { borderTopWidth: 1, borderTopColor: 'rgba(199,122,89,0.12)', marginTop: 11, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  annualValue: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 6 },
  annualBoundary: { flex: 1, alignItems: 'flex-end' },
  annualBoundaryValue: { color: colors.ink, fontSize: 9, fontWeight: '600', marginTop: 6 },
  annualBoundaryLabel: { color: colors.muted, fontSize: 7, marginTop: 3 },
  luckPeriods: { gap: 8, paddingTop: 12, paddingBottom: 4, paddingRight: 4 },
  luckPeriodCard: { position: 'relative', width: 108, minHeight: 150, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.card, padding: 12 },
  luckPeriodActive: { borderColor: colors.terracotta, backgroundColor: '#FFF8F2' },
  currentTag: { position: 'absolute', top: 9, right: 9, color: colors.terracotta, fontSize: 7, fontWeight: '700' },
  luckIndex: { color: colors.muted, fontSize: 8 },
  luckPillar: { color: colors.ink, fontSize: 22, fontWeight: '600', marginTop: 13 },
  luckTenGod: { color: colors.sage, fontSize: 9, marginTop: 5 },
  luckDivider: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  luckAge: { color: colors.ink, fontSize: 9, fontWeight: '600' },
  luckDate: { color: colors.muted, fontSize: 8, marginTop: 5 },
  luckMeta: { color: '#A1A39B', fontSize: 7, textAlign: 'center', marginTop: 10 },
  engineMeta: { color: '#A1A39B', fontSize: 8, textAlign: 'center', marginTop: 13 },
  storageCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.card, marginTop: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  storageTitle: { color: colors.ink, fontSize: 11, fontWeight: '600' },
  storageText: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 4 },
  storageMessage: { color: colors.sage, fontSize: 8, marginTop: 5 },
  storageButton: { minWidth: 54, minHeight: 34, borderRadius: 9, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  storageButtonText: { color: colors.sage, fontSize: 9, fontWeight: '700' },
  disclaimer: { color: '#999C94', fontSize: 8, lineHeight: 14, textAlign: 'center', marginTop: 18 },
});
