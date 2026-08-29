import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BaziSheet } from './src/BaziSheet';
import {
  BaziCalculationInput,
  BaziCurrentContextResult,
  BaziInterpretationResult,
  InterpretationFocus,
  ZhishiApiError,
  calculateBaziCurrentContext,
  generateBaziInterpretation,
  getApiHealth,
} from './src/api';
import { loadStoredBaziChart } from './src/chartStorage';
import {
  ClarityRecord,
  clearClarityRecords,
  deleteClarityRecord,
  loadClarityRecords,
  saveClarityRecord,
  updateClarityRecord,
} from './src/clarityStorage';
import {
  DailyStateRecord,
  clearDailyStateRecords,
  deleteDailyStateRecord,
  getLocalDateKey,
  loadDailyStateRecords,
  saveDailyStateRecord,
} from './src/dailyStateStorage';

type ViewKey = 'daily' | 'journey' | 'year';
type ModalKey = 'clarity' | 'clarity-record' | 'daily-state' | 'safety' | 'profile' | 'bazi' | null;

const colors = {
  paper: '#F7F5EF',
  card: '#FFFEFA',
  ink: '#252927',
  muted: '#7D817B',
  line: 'rgba(43,48,43,0.12)',
  sage: '#899B7D',
  sageDeep: '#586D54',
  terracotta: '#C77A59',
  gold: '#C4A15F',
  lilac: '#9588A9',
  blue: '#70909E',
};

function Kicker({ label, color = colors.sage }: { label: string; color?: string }) {
  return <View style={styles.kicker}><View style={[styles.kickerDot, { backgroundColor: color }]} /><Text style={styles.kickerText}>{label}</Text></View>;
}

function ArrowButton({ label = '→', onPress }: { label?: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}><Text style={styles.arrowButtonText}>{label}</Text></Pressable>;
}

function PrimaryButton({ label, onPress, done = false, disabled = false }: { label: string; onPress: () => void; done?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, done && styles.primaryButtonDone, pressed && styles.pressed, disabled && styles.disabled]}><Text style={styles.primaryButtonLabel}>{label}</Text><Text style={styles.primaryButtonArrow}>{done ? '✓' : '→'}</Text></Pressable>;
}

function StepBackButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.stepBackButton}><Text style={styles.stepBackButtonText}>← 返回上一步</Text></Pressable>;
}

function ScoreDots({ value, color }: { value: number; color: string }) {
  return <View style={styles.scoreDots}>{[1, 2, 3, 4, 5].map(item => <View key={item} style={[styles.scoreDot, item <= value && { backgroundColor: color, borderColor: color }]} />)}</View>;
}

function Header({ onSafety, onProfile, apiOnline }: { onSafety: () => void; onProfile: () => void; apiOnline: boolean }) {
  return <View style={styles.header}>
    <View style={styles.brandLine}><View style={styles.brandMark}><Text style={styles.brandMarkText}>知</Text></View><View><Text style={styles.brandName}>知时</Text><Text style={styles.brandSubtitle}>{apiOnline ? '东方人生导航 · 已连接' : '东方人生导航'}</Text></View></View>
    <View style={styles.headerRight}><Pressable onPress={onSafety} style={styles.headerIcon}><Text>♡</Text></Pressable><Pressable onPress={onProfile} style={styles.profileChip}><View style={styles.avatar}><Text style={styles.avatarText}>我</Text></View><Text style={styles.profileName}>设置</Text><Text style={styles.chevron}>⌄</Text></Pressable></View>
  </View>;
}

type SavedBaziContextState = {
  loading: boolean;
  context: BaziCurrentContextResult | null;
  chartInput: BaziCalculationInput | null;
  timezone: string;
  savedAt: string;
  error: string;
};

function useSavedBaziContext(revision: number): SavedBaziContextState {
  const [state, setState] = useState<SavedBaziContextState>({ loading: true, context: null, chartInput: null, timezone: 'UTC', savedAt: '', error: '' });
  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    loadStoredBaziChart()
      .then(stored => {
        if (!active) return null;
        if (!stored) {
          setState({ loading: false, context: null, chartInput: null, timezone: 'UTC', savedAt: '', error: '' });
          return null;
        }
        return calculateBaziCurrentContext(stored.input).then(context => ({ context, stored }));
      })
      .then(result => {
        if (!active || !result) return;
        setState({ loading: false, context: result.context, chartInput: result.stored.input, timezone: result.stored.input.iana_timezone, savedAt: result.stored.saved_at, error: '' });
      })
      .catch(requestError => {
        if (!active) return;
        setState({ loading: false, context: null, chartInput: null, timezone: 'UTC', savedAt: '', error: requestError instanceof Error ? requestError.message : '命盘上下文读取失败，请稍后重试。' });
      });
    return () => { active = false; };
  }, [revision]);
  return state;
}

type ClarityRecordsState = {
  loading: boolean;
  records: ClarityRecord[];
  error: string;
};

function useClarityRecords(revision: number): ClarityRecordsState {
  const [state, setState] = useState<ClarityRecordsState>({ loading: true, records: [], error: '' });
  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    loadClarityRecords()
      .then(records => {
        if (active) setState({ loading: false, records, error: '' });
      })
      .catch(loadError => {
        if (!active) return;
        setState({
          loading: false,
          records: [],
          error: loadError instanceof Error ? loadError.message : '本机记录读取失败，请稍后重试。',
        });
      });
    return () => { active = false; };
  }, [revision]);
  return state;
}

type DailyStateRecordsState = {
  loading: boolean;
  records: DailyStateRecord[];
  error: string;
};

function useDailyStateRecords(revision: number): DailyStateRecordsState {
  const [state, setState] = useState<DailyStateRecordsState>({ loading: true, records: [], error: '' });
  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    loadDailyStateRecords()
      .then(records => {
        if (active) setState({ loading: false, records, error: '' });
      })
      .catch(loadError => {
        if (!active) return;
        setState({
          loading: false,
          records: [],
          error: loadError instanceof Error ? loadError.message : '每日状态读取失败，请稍后重试。',
        });
      });
    return () => { active = false; };
  }, [revision]);
  return state;
}

function formatDailyStateDate(localDate: string): string {
  const date = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return localDate;
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function formatClarityDate(value: string, includeYear = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    ...(includeYear ? { year: 'numeric' as const } : {}),
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function DailyScreen({ onClarity, onBazi, onOpenRecord, onDailyState, latestRecord, todayState, dailyStateLoading, dailyStateError, revision }: { onClarity: () => void; onBazi: () => void; onOpenRecord: (record: ClarityRecord) => void; onDailyState: (record: DailyStateRecord | null) => void; latestRecord: ClarityRecord | null; todayState: DailyStateRecord | null; dailyStateLoading: boolean; dailyStateError: string; revision: number }) {
  const { loading, context, chartInput, timezone, error } = useSavedBaziContext(revision);
  const dateLabel = context?.as_of_local.replace('T', ' ').slice(0, 16) ?? new Date().toLocaleDateString('zh-CN');
  return <View>
    <View style={styles.heading}><Text style={styles.eyebrow}>TODAY · {dateLabel}</Text><Text style={styles.pageTitle}>今天，只显示有依据的内容。</Text><Text style={styles.pageSubtitle}>当前版本不根据命理自动生成行动建议；这里先提供可复算的周期位置和一个不替你下结论的梳理工具。</Text></View>
    {dailyStateLoading ? <View style={[styles.card, styles.todayStateLoading]}><ActivityIndicator color={colors.sageDeep} /><Text style={styles.yearLoadingText}>正在读取今天的真实状态…</Text></View> : null}
    {!dailyStateLoading && dailyStateError ? <View style={[styles.card, styles.yearErrorCard]}><Kicker label="本机状态读取失败" color={colors.terracotta} /><Text style={styles.todayStateTitle}>今天的状态暂时没有读出来。</Text><Text style={styles.todayStateText}>{dailyStateError}</Text><PrimaryButton label="重新记录今天状态" onPress={() => onDailyState(null)} /></View> : null}
    {!dailyStateLoading && !dailyStateError && !todayState ? <View style={[styles.card, styles.todayStateEmpty]}><Kicker label="现实状态 · 今天" color={colors.sage} /><Text style={styles.todayStateTitle}>现在的你，比任何推断更重要。</Text><Text style={styles.todayStateText}>记录能量、压力、感受和正在关注的领域。知时只保存你选择的数值，不根据它诊断或下结论。</Text><PrimaryButton label="记录今天状态" onPress={() => onDailyState(null)} /></View> : null}
    {!dailyStateLoading && !dailyStateError && todayState ? <Pressable accessibilityRole="button" accessibilityLabel={`更新今天状态，${todayState.emotion}，能量 ${todayState.energy}，压力 ${todayState.stress}`} onPress={() => onDailyState(todayState)} style={[styles.card, styles.todayStateCard]}><View style={styles.todayStateTop}><Kicker label="现实状态 · 今天" color={colors.sage} /><Text style={styles.todayStateSaved}>已记录</Text></View><Text style={styles.todayStateTitle}>{todayState.emotion} · {todayState.focusArea}</Text><View style={styles.todayStateMetrics}><View style={styles.todayStateMetric}><View style={styles.todayStateMetricHeader}><Text style={styles.todayStateMetricLabel}>能量</Text><Text style={styles.todayStateMetricValue}>{todayState.energy}/5</Text></View><ScoreDots value={todayState.energy} color={colors.sageDeep} /></View><View style={styles.todayStateMetric}><View style={styles.todayStateMetricHeader}><Text style={styles.todayStateMetricLabel}>压力</Text><Text style={styles.todayStateMetricValue}>{todayState.stress}/5</Text></View><ScoreDots value={todayState.stress} color={colors.terracotta} /></View></View>{todayState.importantEvent ? <Text style={styles.todayStateEvent} numberOfLines={2}>今天的重要事件：{todayState.importantEvent}</Text> : null}<Text style={styles.todayStateEdit}>点击更新今天状态 →</Text></Pressable> : null}
    {loading ? <View style={[styles.card, styles.yearLoadingCard]}><ActivityIndicator color={colors.sageDeep} /><Text style={styles.yearLoadingText}>正在读取本机命盘并定位当前周期…</Text></View> : null}
    {!loading && !context && !error ? <View style={[styles.card, styles.todayEmptyCard]}><Kicker label="从真实命盘开始" color={colors.terracotta} /><Text style={styles.todayEmptyTitle}>没有命盘，就不生成“今日判断”。</Text><Text style={styles.todayEmptyText}>先完成排盘并主动保存。系统会使用你的出生时区、精确节气边界和规则审计结果。</Text><PrimaryButton label="建立并保存命盘" onPress={onBazi} /></View> : null}
    {!loading && error ? <View style={[styles.card, styles.yearErrorCard]}><Kicker label="读取失败" color={colors.terracotta} /><Text style={styles.todayEmptyTitle}>当前周期没有通过读取。</Text><Text style={styles.todayEmptyText}>{error}</Text><PrimaryButton label="检查命盘" onPress={onBazi} /></View> : null}
    {!loading && context && !context.user_visible ? <View style={[styles.card, styles.yearErrorCard]}><Kicker label="审计未通过" color={colors.terracotta} /><Text style={styles.todayEmptyTitle}>结果已停止展示。</Text><Text style={styles.todayEmptyText}>知时不会用近似结果替代失败结果。请更新命盘后再试。</Text><PrimaryButton label="更新命盘" onPress={onBazi} /></View> : null}
    {!loading && context?.user_visible ? <>
      <View style={[styles.card, styles.todayCycleHero]}><View style={styles.todayCycleTop}><Kicker label="当前确定性周期" color={colors.terracotta} /><Text style={styles.todayVerified}>校验通过</Text></View><View style={styles.todayPillarRow}><View style={styles.todayPillarItem}><Text style={styles.todayPillarLabel}>流年</Text><Text style={styles.todayPillarValue}>{context.annual_cycle.pillar.value}</Text><Text style={styles.todayPillarMeta}>{context.annual_cycle.label_year}</Text></View><View style={styles.todayPillarDivider} /><View style={styles.todayPillarItem}><Text style={styles.todayPillarLabel}>流月</Text><Text style={styles.todayPillarValue}>{context.monthly_cycle.pillar.value}</Text><Text style={styles.todayPillarMeta}>第 {context.monthly_cycle.sequence_from_lichun} 月</Text></View></View><View style={styles.todayBoundaryBox}><Text style={styles.todayBoundaryLabel}>下次流月交接 · {context.monthly_cycle.end_boundary.name}</Text><Text style={styles.todayBoundaryValue}>{formatCycleBoundary(context.monthly_cycle.end_boundary.boundary_time_utc, timezone)}</Text></View></View>
      <View style={[styles.card, styles.todayChartCard]}><Kicker label="命盘底图" color={colors.sage} /><View style={styles.todayChartPillars}>{(['year', 'month', 'day', 'hour'] as const).map(key => <View key={key} style={styles.todayChartPillar}><Text style={styles.todayChartLabel}>{{ year: '年', month: '月', day: '日', hour: '时' }[key]}</Text><Text style={styles.todayChartValue}>{context.chart.pillars[key].value}</Text></View>)}</View><Text style={styles.todayEvidence}>{context.audit.primary_engine} × {context.audit.verification_engine}</Text><Text style={styles.todayEvidence}>{context.chart.rule_profile.timezone_database} · {context.chart.calculation_hash.slice(0, 12)}</Text><Pressable onPress={onBazi} style={styles.todayTextButton}><Text style={styles.todayTextButtonLabel}>查看或更新命盘 →</Text></Pressable></View>
    </> : null}
    {latestRecord ? <Pressable onPress={() => onOpenRecord(latestRecord)} style={[styles.card, styles.latestRecordCard]}><Kicker label="最近一次现实记录" color={colors.lilac} /><Text style={styles.latestRecordDate}>{formatClarityDate(latestRecord.createdAt)}</Text><Text style={styles.latestRecordFact} numberOfLines={3}>{latestRecord.fact}</Text><View style={styles.latestRecordFooter}><Text style={styles.latestRecordEmotion}>{latestRecord.emotion}</Text><Text style={styles.latestRecordLink}>打开记录 →</Text></View></Pressable> : null}
    <Pressable onPress={onClarity} style={[styles.card, styles.todayClarityCard]}><Kicker label="不依赖命理" color={colors.blue} /><View style={styles.quickRow}><View style={{ flex: 1 }}><Text style={styles.quickTitle}>{latestRecord ? '再梳理一件现实里的事' : '我现在有点乱'}</Text><Text style={styles.quickText}>只整理你实际填写的事实、感受、解释和担心，并由你决定是否保存。</Text></View><ArrowButton onPress={onClarity} /></View></Pressable>
    {!loading && context?.user_visible && chartInput ? <PersonalizedInterpretationPanel chartInput={chartInput} context={context} /> : null}
  </View>;
}

function DailyStateOverview({ records, loading, error, onOpen }: { records: DailyStateRecord[]; loading: boolean; error: string; onOpen: (record: DailyStateRecord | null) => void }) {
  const recent = records.slice(0, 7);
  const chronological = [...recent].reverse();
  const averageEnergy = recent.length ? recent.reduce((total, record) => total + record.energy, 0) / recent.length : 0;
  const averageStress = recent.length ? recent.reduce((total, record) => total + record.stress, 0) / recent.length : 0;
  const today = records.find(record => record.localDate === getLocalDateKey()) ?? null;
  if (loading) return <View style={[styles.card, styles.stateOverviewLoading]}><ActivityIndicator color={colors.sageDeep} /><Text style={styles.yearLoadingText}>正在读取真实状态趋势…</Text></View>;
  if (error) return <View style={[styles.card, styles.yearErrorCard]}><Kicker label="状态读取失败" color={colors.terracotta} /><Text style={styles.journeyEmptyTitle}>短期状态暂时不可用。</Text><Text style={styles.journeyEmptyText}>{error}</Text></View>;
  if (!records.length) return <View style={[styles.card, styles.stateOverviewEmpty]}><Kicker label="现实状态时间线" color={colors.blue} /><Text style={styles.stateOverviewTitle}>还没有每日状态记录。</Text><Text style={styles.stateOverviewText}>先记录今天的能量、压力、感受和关注领域。只有真实保存的数据才会形成趋势。</Text><PrimaryButton label="记录今天状态" onPress={() => onOpen(null)} /></View>;
  return <View style={[styles.card, styles.stateOverviewCard]}>
    <View style={styles.stateOverviewTop}><View style={styles.journeySummaryCopy}><Kicker label={`最近 ${recent.length} 次真实记录`} color={colors.blue} /><Text style={styles.stateOverviewTitle}>短期状态，不做诊断。</Text></View><Text style={styles.stateOverviewCount}>{records.length}<Text style={styles.stateOverviewCountUnit}> 天</Text></Text></View>
    <View style={styles.stateAverageRow}><View style={styles.stateAverageItem}><Text style={styles.stateAverageLabel}>平均能量</Text><Text style={styles.stateAverageValue}>{averageEnergy.toFixed(1)}</Text></View><View style={styles.stateAverageDivider} /><View style={styles.stateAverageItem}><Text style={styles.stateAverageLabel}>平均压力</Text><Text style={styles.stateAverageValue}>{averageStress.toFixed(1)}</Text></View></View>
    <View style={styles.stateTrendChart}>{chronological.map(record => <View key={record.id} style={styles.stateTrendColumn}><View style={styles.stateTrendBars}><View style={[styles.stateTrendBar, styles.stateTrendEnergy, { height: record.energy * 7 }]} /><View style={[styles.stateTrendBar, styles.stateTrendStress, { height: record.stress * 7 }]} /></View><Text style={styles.stateTrendDay}>{record.localDate.slice(5).replace('-', '/')}</Text></View>)}</View>
    <View style={styles.stateTrendLegend}><Text style={styles.stateTrendLegendEnergy}>● 能量</Text><Text style={styles.stateTrendLegendStress}>● 压力</Text><Text style={styles.stateTrendLimit}>只基于已保存数值</Text></View>
    <View style={styles.stateRecentList}>{records.slice(0, 3).map(record => <Pressable key={record.id} accessibilityRole="button" accessibilityLabel={`${formatDailyStateDate(record.localDate)}，${record.emotion}，${record.focusArea}`} onPress={() => onOpen(record)} style={styles.stateRecentRow}><View><Text style={styles.stateRecentDate}>{formatDailyStateDate(record.localDate)}</Text><Text style={styles.stateRecentTitle}>{record.emotion} · {record.focusArea}</Text></View><View style={styles.stateRecentScores}><Text style={styles.stateRecentEnergy}>能 {record.energy}</Text><Text style={styles.stateRecentStress}>压 {record.stress}</Text><Text style={styles.stateRecentArrow}>→</Text></View></Pressable>)}</View>
    <PrimaryButton label={today ? '更新今天状态' : '记录今天状态'} onPress={() => onOpen(today)} />
  </View>;
}

function JourneyScreen({ records, loading, error, dailyStates, dailyStatesLoading, dailyStatesError, onClarity, onOpenRecord, onOpenDailyState }: { records: ClarityRecord[]; loading: boolean; error: string; dailyStates: DailyStateRecord[]; dailyStatesLoading: boolean; dailyStatesError: string; onClarity: () => void; onOpenRecord: (record: ClarityRecord) => void; onOpenDailyState: (record: DailyStateRecord | null) => void }) {
  const [query, setQuery] = useState('');
  const [emotionFilter, setEmotionFilter] = useState('全部');
  const emotions = ['全部', '害怕', '愤怒', '无力', '羞耻', '后悔', '失望', '麻木', '其他'];
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const filteredRecords = records.filter(record => {
    const emotionMatches = emotionFilter === '全部' || record.emotion === emotionFilter;
    if (!emotionMatches) return false;
    if (!normalizedQuery) return true;
    return [record.fact, record.emotion, record.interpretation, record.worry, record.nextQuestion]
      .some(value => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
  });
  const filterActive = Boolean(normalizedQuery) || emotionFilter !== '全部';
  return <View>
    <View style={styles.heading}><Text style={styles.eyebrow}>JOURNEY · 现实记录</Text><Text style={styles.pageTitle}>把发生过的事，慢慢连成自己的章节。</Text><Text style={styles.pageSubtitle}>事实、感受、解释和担心分开保存。这里不根据命理替你编故事，也不用虚构的完成比例催促你。</Text></View>
    <DailyStateOverview records={dailyStates} loading={dailyStatesLoading} error={dailyStatesError} onOpen={onOpenDailyState} />
    {loading ? <View style={[styles.card, styles.yearLoadingCard]}><ActivityIndicator color={colors.sageDeep} /><Text style={styles.yearLoadingText}>正在读取本机记录…</Text></View> : null}
    {!loading && error ? <View style={[styles.card, styles.yearErrorCard]}><Kicker label="读取失败" color={colors.terracotta} /><Text style={styles.journeyEmptyTitle}>记录暂时没有读出来。</Text><Text style={styles.journeyEmptyText}>{error}</Text></View> : null}
    {!loading && !error && records.length === 0 ? <View style={[styles.card, styles.journeyEmptyCard]}><Kicker label="从第一条真实记录开始" color={colors.lilac} /><Text style={styles.journeyEmptyTitle}>这里还没有内容。</Text><Text style={styles.journeyEmptyText}>写下一件已经发生的事，再把感受、解释和担心分开。保存后就能从这里回看。</Text><PrimaryButton label="做一次事实梳理" onPress={onClarity} /></View> : null}
    {!loading && !error && records.length > 0 ? <>
      <View style={[styles.card, styles.journeySummaryCard]}><View style={styles.journeySummaryTop}><View style={styles.journeySummaryCopy}><Kicker label="只统计你保存的内容" color={colors.sage} /><Text style={styles.journeySummaryTitle}>已经留下 {records.length} 次梳理</Text></View><Text style={styles.journeySummaryNumber}>{records.length}</Text></View><Text style={styles.journeySummaryText}>最近一次：{formatClarityDate(records[0].createdAt)}。这些记录只保存在当前设备，可在设置中统一清除。</Text><PrimaryButton label="记录一件新发生的事" onPress={onClarity} /></View>
      <View style={styles.journeyToolsCard}>
        <View style={styles.journeySearchRow}><Text style={styles.journeySearchIcon}>⌕</Text><TextInput accessibilityLabel="搜索现实记录" value={query} onChangeText={setQuery} placeholder="搜索事实、解释、担心或下一步" placeholderTextColor="#9DA199" returnKeyType="search" style={styles.journeySearchInput} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="清除搜索" onPress={() => setQuery('')} style={styles.journeySearchClear}><Text style={styles.journeySearchClearText}>×</Text></Pressable> : null}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.journeyEmotionFilters}>{emotions.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: emotionFilter === item }} onPress={() => setEmotionFilter(item)} style={[styles.journeyFilterChip, emotionFilter === item && styles.journeyFilterChipActive]}><Text style={[styles.journeyFilterChipText, emotionFilter === item && styles.journeyFilterChipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
        <Text style={styles.journeyResultCount}>{filterActive ? `找到 ${filteredRecords.length} 条记录` : `按时间查看全部 ${records.length} 条记录`}</Text>
      </View>
      {filteredRecords.length > 0 ? <View style={styles.journeyRecordList}>{filteredRecords.map((record, index) => <View key={record.id} style={styles.journeyTimelineRow}><View style={styles.journeyTimelineRail}><View style={styles.journeyTimelineDot} />{index < filteredRecords.length - 1 ? <View style={styles.journeyTimelineLine} /> : null}</View><Pressable accessibilityRole="button" accessibilityLabel={`${formatClarityDate(record.createdAt, true)}，${record.emotion}，${record.fact}`} onPress={() => onOpenRecord(record)} style={({ pressed }) => [styles.journeyRecordCard, pressed && styles.pressed]}><View style={styles.journeyRecordMeta}><Text style={styles.journeyRecordDate}>{formatClarityDate(record.createdAt, true)}</Text><Text style={styles.journeyRecordEmotion}>{record.emotion}</Text></View><Text style={styles.journeyRecordFact} numberOfLines={3}>{record.fact}</Text>{record.nextQuestion ? <Text style={styles.journeyRecordQuestion} numberOfLines={2}>下一步确认：{record.nextQuestion}</Text> : null}<Text style={styles.journeyRecordOpen}>查看或编辑这条记录 →</Text></Pressable></View>)}</View> : <View style={[styles.card, styles.journeyNoResults]}><Text style={styles.journeyNoResultsTitle}>没有符合条件的记录。</Text><Text style={styles.journeyNoResultsText}>换一个关键词或感受筛选，不会影响已经保存的内容。</Text><Pressable onPress={() => { setQuery(''); setEmotionFilter('全部'); }} style={styles.journeyResetButton}><Text style={styles.journeyResetButtonText}>清除筛选</Text></Pressable></View>}
    </> : null}
  </View>;
}

function formatCycleBoundary(value: string, timezone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return `${new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)} · ${timezone}`;
  } catch {
    return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  }
}

const interpretationFocusOptions: Array<[InterpretationFocus, string]> = [
  ['overview', '整体节奏'],
  ['career', '事业与学习'],
  ['relationships', '关系互动'],
  ['wellbeing', '身心节奏'],
];

function PersonalizedInterpretationPanel({
  chartInput,
  context,
}: {
  chartInput: BaziCalculationInput;
  context: BaziCurrentContextResult;
}) {
  const [focus, setFocus] = useState<InterpretationFocus>('overview');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<BaziInterpretationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const generated = await generateBaziInterpretation(
        chartInput,
        [focus],
        question,
        context.as_of_utc,
      );
      if (generated.calculation_hash !== context.chart.calculation_hash) {
        setError('解读绑定的计算版本与当前命盘不一致，已停止展示。请重新读取命盘后再试。');
        return;
      }
      setResult(generated);
    } catch (requestError) {
      if (requestError instanceof ZhishiApiError && requestError.code === 'interpretation_provider_not_configured') {
        setError('DeepSeek 解读服务尚未完成后端配置，请稍后再试。');
      } else {
        setError(requestError instanceof Error ? requestError.message : '个性化解读生成失败，请稍后重试。');
      }
    } finally {
      setLoading(false);
    }
  };

  const evidenceById = new Map(result?.evidence_catalog.map(item => [item.id, item]) ?? []);

  return <View style={styles.interpretationWrap}>
    <View style={[styles.card, styles.interpretationRequestCard]}>
      <View style={styles.interpretationHeader}><Kicker label="DeepSeek 个性化解读" color={colors.gold} /><Text style={styles.aiChip}>AI 生成</Text></View>
      <Text style={styles.interpretationRequestTitle}>只解释已审计的命盘事实。</Text>
      <Text style={styles.interpretationRequestText}>选择一个当前最想观察的方向。模型不能重新排盘，也不能补写强弱、喜忌、格局或吉凶。</Text>
      <View style={styles.interpretationFocusGrid}>{interpretationFocusOptions.map(([key, label]) => <Pressable key={key} onPress={() => setFocus(key)} style={[styles.interpretationFocusButton, focus === key && styles.interpretationFocusActive]}><Text style={[styles.interpretationFocusText, focus === key && styles.interpretationFocusTextActive]}>{label}</Text></Pressable>)}</View>
      <Text style={styles.clarityFieldLabel}>可选：你想用现实经历核对什么？</Text>
      <TextInput value={question} onChangeText={setQuestion} maxLength={300} multiline textContentType="none" autoCorrect spellCheck returnKeyType="default" placeholder="例如：最近工作节奏变化，我该观察哪些真实信号？请不要填写姓名、联系方式等敏感信息。" placeholderTextColor="#A9ADA4" style={styles.interpretationQuestion} />
      <Text style={styles.inputVoiceHint}>文字输入或 iPhone 键盘右下角的听写话筒均可；知时不会录音。</Text>
      <View style={styles.aiDisclosureCard}><Text style={styles.aiDisclosureTitle}>生成前说明</Text><Text style={styles.aiDisclosureText}>点击生成后，知时会把已审计的四柱结构、十神标签、当前大运/流年/流月、时间精度和你的可选问题发送给 DeepSeek。不会发送出生日期、出生地点或经纬度。计算仍完全由知时引擎完成。</Text></View>
      {error ? <View style={styles.interpretationError}><Text style={styles.interpretationErrorText}>{error}</Text></View> : null}
      <Pressable disabled={loading} onPress={generate} style={({ pressed }) => [styles.interpretationGenerateButton, pressed && styles.pressed, loading && styles.disabled]}>{loading ? <><ActivityIndicator size="small" color="#FFF" /><Text style={styles.interpretationGenerateText}>正在校验并生成…</Text></> : <><Text style={styles.interpretationGenerateText}>{result ? '重新生成解读' : '确认并生成解读'}</Text><Text style={styles.primaryButtonArrow}>→</Text></>}</Pressable>
      <Text style={styles.interpretationTransient}>本次文字只保留在当前页面，知时不会自动保存。</Text>
    </View>

    {result ? <View style={[styles.card, styles.interpretationResultCard]}>
      <View style={styles.interpretationHeader}><Kicker label="文化解释层" color={colors.lilac} /><Text style={styles.aiChip}>AI 生成</Text></View>
      <Text style={styles.interpretationSummary}>{result.summary}</Text>
      {result.sections.map(section => <View key={section.id} style={styles.interpretationSection}>
        <Text style={styles.interpretationSectionTitle}>{section.title}</Text>
        <Text style={styles.interpretationSectionText}>{section.interpretation}</Text>
        <Text style={styles.interpretationEvidenceLabel}>引用的确定性依据</Text>
        <View style={styles.interpretationEvidenceList}>{section.evidence_ids.map(evidenceId => {
          const evidence = evidenceById.get(evidenceId);
          return evidence ? <View key={evidenceId} style={styles.interpretationEvidenceItem}><Text style={styles.interpretationEvidenceTitle}>{evidence.label}</Text><Text style={styles.interpretationEvidenceValue}>{evidence.value}</Text></View> : null;
        })}</View>
        {section.reflection_questions.map(item => <Text key={item} style={styles.interpretationQuestionText}>想一想 · {item}</Text>)}
      </View>)}
      <View style={styles.interpretationNotice}><Text style={styles.interpretationNoticeTitle}>时间与边界</Text><Text style={styles.interpretationNoticeText}>{result.uncertainty_notice}</Text></View>
      <View style={styles.interpretationNotice}><Text style={styles.interpretationNoticeTitle}>使用边界</Text><Text style={styles.interpretationNoticeText}>{result.professional_advice_notice}</Text>{result.cautions.map(item => <Text key={item} style={styles.interpretationCaution}>• {item}</Text>)}</View>
      <Text style={styles.interpretationMeta}>{result.disclosure} · {result.model}</Text>
    </View> : null}
  </View>;
}

function YearScreen({ onBazi, revision }: { onBazi: () => void; revision: number }) {
  const { loading, context, chartInput, timezone, savedAt, error } = useSavedBaziContext(revision);

  const annual = context?.annual_cycle;
  const monthly = context?.monthly_cycle;
  const luck = context?.current_luck;

  return <View>
    <View style={styles.heading}><Text style={styles.eyebrow}>YEAR · 精确周期</Text><Text style={styles.pageTitle}>先展示算得准的部分。</Text><Text style={styles.pageSubtitle}>年度页只显示命盘绑定、边界可追溯且审计通过的历法结果；AI 文化解释与确定性计算分层呈现。</Text></View>
    {loading ? <View style={[styles.card, styles.yearLoadingCard]}><ActivityIndicator color={colors.sageDeep} /><Text style={styles.yearLoadingText}>正在按已保存命盘定位当前周期…</Text></View> : null}
    {!loading && !context && !error ? <View style={[styles.card, styles.yearEmptyCard]}><Kicker label="需要一张已保存命盘" color={colors.terracotta} /><Text style={styles.yearEmptyTitle}>年度导航不能脱离出生资料生成。</Text><Text style={styles.yearEmptyText}>建立命盘并主动保存后，这里才会读取真实流年、流月和大运边界。命盘只保存在本机。</Text><PrimaryButton label="建立并保存命盘" onPress={onBazi} /></View> : null}
    {!loading && error ? <View style={[styles.card, styles.yearErrorCard]}><Kicker label="暂时无法计算" color={colors.terracotta} /><Text style={styles.yearEmptyTitle}>年度周期没有通过读取。</Text><Text style={styles.yearEmptyText}>{error}</Text><PrimaryButton label="检查或更新命盘" onPress={onBazi} /></View> : null}
    {!loading && context && !context.user_visible ? <View style={[styles.card, styles.yearErrorCard]}><Kicker label="审计未通过" color={colors.terracotta} /><Text style={styles.yearEmptyTitle}>结果已停止展示。</Text><Text style={styles.yearEmptyText}>系统没有用近似结果替代失败结果。请更新命盘，或稍后重新计算。</Text><PrimaryButton label="更新命盘" onPress={onBazi} /></View> : null}
    {!loading && context?.user_visible && annual && monthly ? <>
      <View style={[styles.card, styles.yearVerifiedHero]}>
        <View style={styles.yearVerifiedTop}><Kicker label={`已审计流年 · ${annual.label_year}`} color={colors.terracotta} /><View style={styles.yearAuditChip}><Text style={styles.yearAuditChipText}>校验通过</Text></View></View>
        <Text style={styles.yearPillar}>{annual.pillar.value}</Text>
        <Text style={styles.yearLayerNote}>确定性历法层 · 不是吉凶解释</Text>
        <View style={styles.yearBoundaryGrid}>
          <View style={styles.yearBoundaryItem}><Text style={styles.yearBoundaryLabel}>{annual.start_boundary.name}起</Text><Text style={styles.yearBoundaryValue}>{formatCycleBoundary(annual.start_boundary.boundary_time_utc, timezone)}</Text></View>
          <View style={styles.yearBoundaryItem}><Text style={styles.yearBoundaryLabel}>{annual.end_boundary.name}止</Text><Text style={styles.yearBoundaryValue}>{formatCycleBoundary(annual.end_boundary.boundary_time_utc, timezone)}</Text></View>
        </View>
      </View>
      <View style={styles.yearCycleGrid}>
        <View style={[styles.card, styles.yearCycleCard]}><Kicker label="当前大运" color={colors.lilac} />{luck?.status === 'active' && luck.current_period ? <><Text style={styles.yearCyclePillar}>{luck.current_period.pillar.value}</Text><Text style={styles.yearCycleMeta}>第 {luck.current_period.index} 运</Text><Text style={styles.yearCycleDetail}>{luck.current_period.start_at_local.slice(0, 10)} — {luck.current_period.end_at_local_exclusive.slice(0, 10)}</Text></> : <><Text style={styles.yearCyclePillar}>{luck?.status === 'pre_luck' ? '未起运' : '范围外'}</Text><Text style={styles.yearCycleDetail}>{luck?.status === 'pre_luck' ? `${luck.next_transition_local?.slice(0, 16).replace('T', ' ') ?? '待定'} 起运` : '当前时刻超出八步大运范围'}</Text></>}</View>
        <View style={[styles.card, styles.yearCycleCard]}><Kicker label={`当前流月 · 第 ${monthly.sequence_from_lichun} 月`} color={colors.blue} /><Text style={styles.yearCyclePillar}>{monthly.pillar.value}</Text><Text style={styles.yearCycleMeta}>{monthly.start_boundary.name} → {monthly.end_boundary.name}</Text><Text style={styles.yearCycleDetail}>{formatCycleBoundary(monthly.end_boundary.boundary_time_utc, timezone)}</Text></View>
      </View>
      <View style={[styles.card, styles.yearAuditCard]}><Kicker label="计算证据" color={colors.sage} /><Text style={styles.yearAuditTitle}>双引擎一致，边界检查已通过。</Text><Text style={styles.yearAuditText}>{context.audit.primary_engine} × {context.audit.verification_engine}</Text><Text style={styles.yearAuditText}>规则 {context.chart.rule_profile.timezone_database} · 哈希 {context.chart.calculation_hash.slice(0, 12)}</Text>{savedAt ? <Text style={styles.yearAuditText}>本机命盘保存于 {new Date(savedAt).toLocaleString('zh-CN')}</Text> : null}</View>
      {chartInput ? <PersonalizedInterpretationPanel chartInput={chartInput} context={context} /> : null}
    </> : null}
  </View>;
}

function StateScalePicker({ label, value, onChange, lowLabel, highLabel, color }: { label: string; value: number; onChange: (value: number) => void; lowLabel: string; highLabel: string; color: string }) {
  return <View style={styles.stateScaleBlock}><View style={styles.stateScaleHeader}><Text style={styles.stateScaleLabel}>{label}</Text><Text style={styles.stateScaleValue}>{value ? `${value}/5` : '请选择'}</Text></View><View style={styles.stateScaleButtons}>{[1, 2, 3, 4, 5].map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${label} ${item} 分`} accessibilityState={{ selected: value === item }} onPress={() => onChange(item)} style={[styles.stateScaleButton, value === item && { backgroundColor: color, borderColor: color }]}><Text style={[styles.stateScaleButtonText, value === item && styles.stateScaleButtonTextActive]}>{item}</Text></Pressable>)}</View><View style={styles.stateScaleEnds}><Text style={styles.stateScaleEndText}>{lowLabel}</Text><Text style={styles.stateScaleEndText}>{highLabel}</Text></View></View>;
}

function DailyStateSheet({ record, onClose, onSaved, onDelete }: { record: DailyStateRecord | null; onClose: () => void; onSaved: (record: DailyStateRecord) => void; onDelete: (id: string) => Promise<void> }) {
  const [energy, setEnergy] = useState(record?.energy ?? 0);
  const [stress, setStress] = useState(record?.stress ?? 0);
  const [emotion, setEmotion] = useState(record?.emotion ?? '');
  const [focusArea, setFocusArea] = useState(record?.focusArea ?? '');
  const [importantEvent, setImportantEvent] = useState(record?.importantEvent ?? '');
  const [note, setNote] = useState(record?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const emotions = ['平静', '开心', '期待', '焦虑', '疲惫', '低落', '愤怒', '其他'];
  const focusAreas = ['事业/学习', '关系', '家庭', '财务', '身心', '自我'];
  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const saved = await saveDailyStateRecord(
        { energy, stress, emotion, focusArea, importantEvent, note },
        record?.localDate ?? getLocalDateKey(),
      );
      onSaved(saved);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '今天的状态没有保存成功，请重试。');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!record) return;
    setDeleting(true);
    setSaveError('');
    try {
      await onDelete(record.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '这条每日状态没有删除成功，请重试。');
      setDeleting(false);
    }
  };
  const dateLabel = formatDailyStateDate(record?.localDate ?? getLocalDateKey());
  return <Sheet title={record ? '编辑每日状态' : '记录今天状态'} onClose={onClose}>
    <Text style={styles.sheetEyebrow}>REALITY CHECK-IN · {dateLabel}</Text>
    <Text style={styles.sheetTitle}>只记录你现在知道的状态。</Text>
    <Text style={styles.sheetSubtitle}>数值用于个人回看，不是医疗或心理评估，也不会自动发送给知时 API 或 DeepSeek。</Text>
    <StateScalePicker label="能量" value={energy} onChange={setEnergy} lowLabel="几乎耗尽" highLabel="精力充足" color={colors.sageDeep} />
    <StateScalePicker label="压力" value={stress} onChange={setStress} lowLabel="很轻" highLabel="非常高" color={colors.terracotta} />
    <Text style={styles.stateFieldLabel}>今天最接近的感受</Text>
    <View style={styles.stateChoiceGrid}>{emotions.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: emotion === item }} onPress={() => setEmotion(item)} style={[styles.stateChoiceButton, emotion === item && styles.stateChoiceSelected]}><Text style={[styles.stateChoiceText, emotion === item && styles.stateChoiceTextSelected]}>{item}</Text></Pressable>)}</View>
    <Text style={styles.stateFieldLabel}>今天最关注的领域</Text>
    <View style={styles.stateFocusGrid}>{focusAreas.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: focusArea === item }} onPress={() => setFocusArea(item)} style={[styles.stateFocusButton, focusArea === item && styles.stateChoiceSelected]}><Text style={[styles.stateChoiceText, focusArea === item && styles.stateChoiceTextSelected]}>{item}</Text></Pressable>)}</View>
    <Text style={styles.stateFieldLabel}>今天发生的重要事件（可选）</Text>
    <TextInput accessibilityLabel="今天发生的重要事件" value={importantEvent} onChangeText={setImportantEvent} maxLength={500} multiline textContentType="none" autoCorrect spellCheck placeholder="例如：收到项目确认，下午与同事沟通了范围。" placeholderTextColor="#A9ADA4" style={styles.clarityInput} />
    <Text style={styles.stateFieldLabel}>给自己留一句备注（可选）</Text>
    <TextInput accessibilityLabel="给自己留一句备注" value={note} onChangeText={setNote} maxLength={1000} multiline textContentType="none" autoCorrect spellCheck placeholder="只写你想在以后回看的内容。" placeholderTextColor="#A9ADA4" style={styles.clarityInput} />
    <View style={styles.localOnlyNotice}><Text style={styles.localOnlyTitle}>同一天只保留一条</Text><Text style={styles.localOnlyText}>再次保存会更新当天记录并保留最初创建时间；历史日期不会因为旅行或时区变化被改写。</Text></View>
    {saveError ? <View style={styles.interpretationError}><Text style={styles.interpretationErrorText}>{saveError}</Text></View> : null}
    {!confirmingDelete ? <PrimaryButton disabled={saving} label={saving ? '正在保存到本机…' : (record ? '保存修改' : '保存今天状态')} done onPress={save} /> : null}
    {record && !confirmingDelete ? <Pressable onPress={() => setConfirmingDelete(true)} style={styles.dangerTextButton}><Text style={styles.dangerTextButtonLabel}>删除这一天的状态</Text></Pressable> : null}
    {record && confirmingDelete ? <View style={styles.deleteConfirmCard}><Text style={styles.deleteConfirmTitle}>确定删除 {dateLabel} 的状态？</Text><Text style={styles.deleteConfirmText}>删除后不会影响事实梳理或命盘，但无法恢复。</Text><View style={styles.deleteConfirmActions}><Pressable disabled={deleting} onPress={() => setConfirmingDelete(false)} style={styles.deleteCancelButton}><Text style={styles.deleteCancelLabel}>取消</Text></Pressable><Pressable disabled={deleting} onPress={remove} style={[styles.deleteButton, deleting && styles.disabled]}><Text style={styles.deleteButtonLabel}>{deleting ? '正在删除…' : '确认删除'}</Text></Pressable></View></View> : null}
  </Sheet>;
}

function ClaritySheet({ step, setStep, onClose, onSaved, initialRecord = null }: { step: number; setStep: (step: number) => void; onClose: () => void; onSaved: (record: ClarityRecord) => void; initialRecord?: ClarityRecord | null }) {
  const [input, setInput] = useState(initialRecord?.fact ?? '');
  const [emotion, setEmotion] = useState(initialRecord?.emotion ?? '');
  const [interpretation, setInterpretation] = useState(initialRecord?.interpretation ?? '');
  const [worry, setWorry] = useState(initialRecord?.worry ?? '');
  const [question, setQuestion] = useState(initialRecord?.nextQuestion ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const editing = Boolean(initialRecord);
  const emotions = ['害怕', '愤怒', '无力', '羞耻', '后悔', '失望', '麻木', '其他'];
  const complete = async () => {
    if (!input.trim() || !emotion) return;
    setSaving(true);
    setSaveError('');
    try {
      const draft = {
        fact: input,
        emotion,
        interpretation,
        worry,
        nextQuestion: question,
      };
      const record = initialRecord
        ? await updateClarityRecord(initialRecord.id, draft)
        : await saveClarityRecord(draft);
      onSaved(record);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '这次梳理没有保存成功，请重试。');
    } finally {
      setSaving(false);
    }
  };
  return <Sheet title={editing ? '编辑现实记录' : '我现在有点乱'} onClose={onClose}>
    <View style={styles.sheetProgress}>{[1, 2, 3].map(i => <View key={i} style={[styles.sheetProgressBar, i <= step && styles.sheetProgressActive]} />)}</View>
    {step === 1 && <><Text style={styles.sheetEyebrow}>01 · {editing ? '核对已经发生的事' : '发生了什么？'}</Text><Text style={styles.sheetTitle}>只写你确认发生的事。</Text><Text style={styles.sheetSubtitle}>不用组织得很完整，也先不要解释原因。</Text><TextInput accessibilityLabel="已经发生的事实" value={input} onChangeText={setInput} maxLength={2000} multiline textContentType="none" autoCorrect spellCheck placeholder="例如：我收到一条消息，对方没有说明截止时间。" placeholderTextColor="#A9ADA4" style={styles.textArea} /><Text style={styles.inputVoiceHint}>可直接打字，也可以使用 iPhone 键盘听写。</Text><PrimaryButton label={input.trim() ? '继续' : '先写下一件事实'} onPress={() => { if (input.trim()) setStep(2); }} /></>}
    {step === 2 && <><StepBackButton onPress={() => setStep(1)} /><Text style={styles.sheetEyebrow}>02 · 现在最强烈的感受是？</Text><Text style={styles.sheetTitle}>先命名它，不把它当结论。</Text><Text style={styles.sheetSubtitle}>这里不会根据情绪自动推断你的处境。</Text><View style={styles.emotionGrid}>{emotions.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: emotion === item }} onPress={() => setEmotion(item)} style={[styles.emotionButton, emotion === item && styles.emotionSelected]}><Text>{item}</Text></Pressable>)}</View><PrimaryButton label={emotion ? '继续' : '先选择一种感受'} onPress={() => { if (emotion) setStep(3); }} /></>}
    {step === 3 && <><StepBackButton onPress={() => setStep(2)} /><Text style={styles.sheetEyebrow}>03 · 把事实、解释和担心分开。</Text><Text style={styles.sheetTitle}>以下内容全部来自你。</Text><View style={styles.triadItem}><Text style={styles.triadLabel}>已经发生的事实</Text><Text style={styles.triadText}>{input}</Text></View><View style={styles.triadItem}><Text style={styles.triadLabel}>当下感受</Text><Text style={styles.triadText}>{emotion}</Text></View><Text style={styles.clarityFieldLabel}>你对事实的解释</Text><TextInput accessibilityLabel="你对事实的解释" value={interpretation} onChangeText={setInterpretation} maxLength={1200} multiline textContentType="none" autoCorrect spellCheck placeholder="例如：我觉得对方可能不重视这件事。" placeholderTextColor="#A9ADA4" style={styles.clarityInput} /><Text style={styles.clarityFieldLabel}>你担心未来会发生什么</Text><TextInput accessibilityLabel="你担心未来会发生什么" value={worry} onChangeText={setWorry} maxLength={1200} multiline textContentType="none" autoCorrect spellCheck placeholder="例如：我担心这会影响后续安排。" placeholderTextColor="#A9ADA4" style={styles.clarityInput} /><Text style={styles.clarityFieldLabel}>下一步只确认哪一个问题？</Text><TextInput accessibilityLabel="下一步只确认哪一个问题" value={question} onChangeText={setQuestion} maxLength={600} multiline textContentType="none" autoCorrect spellCheck placeholder="例如：这件事的截止时间是什么？" placeholderTextColor="#A9ADA4" style={styles.clarityInput} /><Text style={styles.inputVoiceHint}>可直接打字，也可以使用 iPhone 键盘听写。</Text><View style={styles.recommendation}><Text style={styles.triadLabel}>{editing ? '修改后的梳理' : '本次梳理'}</Text><Text style={styles.recommendationTitle}>{question.trim() || '暂时没有下一步问题也可以保存。'}</Text><Text style={styles.triadText}>知时没有替你判断，也没有根据命理生成建议。保存后可在“章节”页回看、继续编辑或删除，内容不会发送到服务器。</Text></View>{saveError ? <View style={styles.interpretationError}><Text style={styles.interpretationErrorText}>{saveError}</Text></View> : null}<PrimaryButton disabled={saving} label={saving ? (editing ? '正在保存修改…' : '正在保存到本机…') : (editing ? '保存修改' : '保存这次梳理')} done onPress={complete} /></>}
  </Sheet>;
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetHeaderTitle}>{title}</Text><Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.sheetContent} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="always" automaticallyAdjustKeyboardInsets>{children}</ScrollView></View>;
}

function ClarityRecordSheet({ record, onClose, onEdit, onDelete }: { record: ClarityRecord; onClose: () => void; onEdit: (record: ClarityRecord) => void; onDelete: (id: string) => Promise<void> }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const remove = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(record.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '记录没有删除成功，请重试。');
      setDeleting(false);
    }
  };
  const fields = [
    ['已经发生的事实', record.fact],
    ['当下感受', record.emotion],
    ['当时的解释', record.interpretation],
    ['担心的事情', record.worry],
    ['下一步想确认', record.nextQuestion],
  ].filter(([, value]) => value);
  return <Sheet title="现实记录" onClose={onClose}>
    <Text style={styles.sheetEyebrow}>{formatClarityDate(record.createdAt, true)}</Text>
    {record.updatedAt !== record.createdAt ? <Text style={styles.recordUpdatedAt}>最后修改于 {formatClarityDate(record.updatedAt, true)}</Text> : null}
    <Text style={styles.recordDetailTitle}>这次梳理由你自己填写。</Text>
    <Text style={styles.sheetSubtitle}>知时只负责把不同层次分开保存，没有根据命盘或模型补写内容。</Text>
    <View style={styles.recordDetailList}>{fields.map(([label, value]) => <View key={label} style={styles.recordDetailItem}><Text style={styles.recordDetailLabel}>{label}</Text><Text style={styles.recordDetailValue}>{value}</Text></View>)}</View>
    <View style={styles.localOnlyNotice}><Text style={styles.localOnlyTitle}>保存在本机</Text><Text style={styles.localOnlyText}>这条记录不会自动发送给知时 API 或 DeepSeek。卸载 App、清除应用数据或主动删除后将无法恢复。</Text></View>
    {deleteError ? <View style={styles.interpretationError}><Text style={styles.interpretationErrorText}>{deleteError}</Text></View> : null}
    {!confirmingDelete ? <PrimaryButton label="编辑这条记录" onPress={() => onEdit(record)} /> : null}
    {!confirmingDelete ? <Pressable onPress={() => setConfirmingDelete(true)} style={styles.dangerTextButton}><Text style={styles.dangerTextButtonLabel}>删除这条记录</Text></Pressable> : <View style={styles.deleteConfirmCard}><Text style={styles.deleteConfirmTitle}>确定永久删除？</Text><Text style={styles.deleteConfirmText}>删除后无法恢复。</Text><View style={styles.deleteConfirmActions}><Pressable disabled={deleting} onPress={() => setConfirmingDelete(false)} style={styles.deleteCancelButton}><Text style={styles.deleteCancelLabel}>取消</Text></Pressable><Pressable disabled={deleting} onPress={remove} style={[styles.deleteButton, deleting && styles.disabled]}><Text style={styles.deleteButtonLabel}>{deleting ? '正在删除…' : '确认删除'}</Text></Pressable></View></View>}
  </Sheet>;
}

function SafetySheet({ onClose }: { onClose: () => void }) {
  return <Sheet title="安全、隐私与使用条款" onClose={onClose}><View style={styles.safetyIcon}><Text>♡</Text></View><Text style={styles.sheetTitle}>现实优先，命理只是文化视角。</Text><Text style={styles.sheetSubtitle}>知时面向 18 岁以上用户，不替代医疗、法律、财务或心理服务，也不会用“注定”“必然”制造恐惧。涉及高风险内容时，请联系专业人士或可信任的人。</Text>{['不预测灾祸、生死和疾病', '不替你做重大人生决定', '确定性计算与 AI 文化解释分层显示', '当前 MVP 不销售数据或投放行为广告'].map(item => <Text key={item} style={styles.safetyItem}>✓  {item}</Text>)}<View style={styles.legalNoticeCard}><Text style={styles.legalNoticeTitle}>美国与欧洲客户基线</Text><Text style={styles.legalNoticeText}>排盘按你提交的出生日期、时间、地点和规则正常计算。选择非精确时间不会停止计算，但实际时刻偏差可能改变四柱、大运、流年和流月。</Text><Text style={styles.legalNoticeText}>出生资料会发送到配置的计算 API；当前 MVP 不主动持久化计算请求。你主动保存的命盘、每日状态和事实梳理保存在当前设备，可分别查看或清除。请勿在未获授权时填写他人的个人资料。</Text><Text style={styles.legalNoticeText}>个性化解释会明确标识为 AI 生成。只有你主动点击生成后，最少量的已审计命盘事实与可选问题才会发送给 DeepSeek；每日状态和事实梳理不会自动发送，确定性排盘也不由 AI 生成。</Text><Text style={styles.legalNoticeText}>你可依据适用的 GDPR、UK GDPR 或美国州隐私法请求访问、更正、删除或选择退出；法定消费者权利不因本提示而被排除。</Text></View><PrimaryButton label="我知道了" onPress={onClose} /></Sheet>;
}

function ProfileSheet({ onClose, onOpenBazi, recordCount, dailyStateCount, onExportRecords, onClearRecords, onClearDailyStates }: { onClose: () => void; onOpenBazi: () => void; recordCount: number; dailyStateCount: number; onExportRecords: () => Promise<void>; onClearRecords: () => Promise<void>; onClearDailyStates: () => Promise<void> }) {
  const [confirmingClear, setConfirmingClear] = useState<'clarity' | 'daily' | null>(null);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearError, setClearError] = useState('');
  const [exportError, setExportError] = useState('');
  const exportRecords = async () => {
    setExporting(true);
    setExportError('');
    try {
      await onExportRecords();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '记录暂时无法导出，请重试。');
    } finally {
      setExporting(false);
    }
  };
  const clearRecords = async (kind: 'clarity' | 'daily') => {
    setClearing(true);
    setClearError('');
    try {
      if (kind === 'clarity') await onClearRecords();
      else await onClearDailyStates();
    } catch (error) {
      setClearError(error instanceof Error ? error.message : '本机记录没有清除成功，请重试。');
      setClearing(false);
    }
  };
  const totalCount = recordCount + dailyStateCount;
  return <Sheet title="设置与本机数据" onClose={onClose}>
    <Text style={styles.sheetEyebrow}>LOCAL FIRST · 本机优先</Text><Text style={styles.sheetTitle}>你保存什么，由你决定。</Text><Text style={styles.sheetSubtitle}>知时目前不要求注册账户。命盘、每日状态与事实梳理保存在当前设备，AI 生成内容仍不自动保存。</Text>
    <View style={styles.settingsDataCard}><Text style={styles.settingsDataLabel}>每日状态</Text><Text style={styles.settingsDataValue}>{dailyStateCount} 天</Text><Text style={styles.settingsDataText}>能量、压力、感受和关注领域按本机日期保存；同一天再次保存会更新原记录。</Text></View>
    <View style={styles.settingsDataCard}><Text style={styles.settingsDataLabel}>事实梳理记录</Text><Text style={styles.settingsDataValue}>{recordCount} 条</Text><Text style={styles.settingsDataText}>可在“章节”搜索、筛选、编辑和逐条删除。</Text></View>
    {totalCount > 0 ? <View style={styles.settingsDataCard}><Text style={styles.settingsDataLabel}>可携带副本</Text><Text style={styles.settingsDataValue}>{totalCount} 组现实记录</Text><Text style={styles.settingsDataText}>通过系统分享导出为纯文字；你自行决定接收应用和接收人。</Text><PrimaryButton disabled={exporting} label={exporting ? '正在打开系统分享…' : '导出全部现实记录'} onPress={exportRecords} /></View> : null}
    <View style={styles.settingsDataCard}><Text style={styles.settingsDataLabel}>命盘资料</Text><Text style={styles.settingsDataValue}>单独管理</Text><Text style={styles.settingsDataText}>时间模式、换日规则、起运算法与出生时间精度都会写入计算哈希。</Text><PrimaryButton label="打开命盘管理" onPress={onOpenBazi} /></View>
    {exportError ? <View style={styles.interpretationError}><Text style={styles.interpretationErrorText}>{exportError}</Text></View> : null}{clearError ? <View style={styles.interpretationError}><Text style={styles.interpretationErrorText}>{clearError}</Text></View> : null}
    {dailyStateCount > 0 && confirmingClear !== 'daily' ? <Pressable disabled={Boolean(confirmingClear)} onPress={() => setConfirmingClear('daily')} style={[styles.dangerTextButton, Boolean(confirmingClear) && styles.disabled]}><Text style={styles.dangerTextButtonLabel}>清除全部每日状态</Text></Pressable> : null}
    {confirmingClear === 'daily' ? <View style={styles.deleteConfirmCard}><Text style={styles.deleteConfirmTitle}>清除全部 {dailyStateCount} 天状态？</Text><Text style={styles.deleteConfirmText}>此操作不会删除事实梳理或命盘；删除后无法恢复。</Text><View style={styles.deleteConfirmActions}><Pressable disabled={clearing} onPress={() => setConfirmingClear(null)} style={styles.deleteCancelButton}><Text style={styles.deleteCancelLabel}>取消</Text></Pressable><Pressable disabled={clearing} onPress={() => clearRecords('daily')} style={[styles.deleteButton, clearing && styles.disabled]}><Text style={styles.deleteButtonLabel}>{clearing ? '正在清除…' : '确认全部清除'}</Text></Pressable></View></View> : null}
    {recordCount > 0 && confirmingClear !== 'clarity' ? <Pressable disabled={Boolean(confirmingClear)} onPress={() => setConfirmingClear('clarity')} style={[styles.dangerTextButton, Boolean(confirmingClear) && styles.disabled]}><Text style={styles.dangerTextButtonLabel}>清除全部事实梳理记录</Text></Pressable> : null}
    {confirmingClear === 'clarity' ? <View style={styles.deleteConfirmCard}><Text style={styles.deleteConfirmTitle}>清除全部 {recordCount} 条事实梳理？</Text><Text style={styles.deleteConfirmText}>此操作不会删除每日状态或命盘；删除后无法恢复。</Text><View style={styles.deleteConfirmActions}><Pressable disabled={clearing} onPress={() => setConfirmingClear(null)} style={styles.deleteCancelButton}><Text style={styles.deleteCancelLabel}>取消</Text></Pressable><Pressable disabled={clearing} onPress={() => clearRecords('clarity')} style={[styles.deleteButton, clearing && styles.disabled]}><Text style={styles.deleteButtonLabel}>{clearing ? '正在清除…' : '确认全部清除'}</Text></Pressable></View></View> : null}
    <PrimaryButton label="完成" onPress={onClose} />
  </Sheet>;
}

function TabBar({ view, setView, onClarity, onBazi }: { view: ViewKey; setView: (view: ViewKey) => void; onClarity: () => void; onBazi: () => void }) {
  return <View style={styles.tabBar}><TabItem active={view === 'daily'} label="今天" icon="◌" onPress={() => setView('daily')} /><TabItem active={view === 'journey'} label="章节" icon="↗" onPress={() => setView('journey')} /><Pressable onPress={onClarity} style={styles.centerTab}><Text style={styles.centerTabIcon}>✦</Text><Text style={styles.centerTabLabel}>有点乱</Text></Pressable><TabItem active={view === 'year'} label="一年" icon="⌁" onPress={() => setView('year')} /><TabItem active={false} label="命盘" icon="盘" onPress={onBazi} /></View>;
}

function TabItem({ active, label, icon, onPress }: { active: boolean; label: string; icon: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.tabItem}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>;
}

export default function App() {
  const [view, setView] = useState<ViewKey>('daily');
  const [modal, setModal] = useState<ModalKey>(null);
  const [clarityStep, setClarityStep] = useState(1);
  const [claritySession, setClaritySession] = useState(0);
  const [recordSession, setRecordSession] = useState(0);
  const [dailyStateSession, setDailyStateSession] = useState(0);
  const [profileSession, setProfileSession] = useState(0);
  const [apiOnline, setApiOnline] = useState(false);
  const [chartRevision, setChartRevision] = useState(0);
  const [clarityRevision, setClarityRevision] = useState(0);
  const [dailyStateRevision, setDailyStateRevision] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<ClarityRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<ClarityRecord | null>(null);
  const [selectedDailyState, setSelectedDailyState] = useState<DailyStateRecord | null>(null);
  const clarityState = useClarityRecords(clarityRevision);
  const dailyStateState = useDailyStateRecords(dailyStateRevision);
  const todayState = dailyStateState.records.find(record => record.localDate === getLocalDateKey()) ?? null;
  const openClarity = () => {
    setEditingRecord(null);
    setClarityStep(1);
    setClaritySession(value => value + 1);
    setModal('clarity');
  };
  const openRecord = (record: ClarityRecord) => {
    setEditingRecord(null);
    setSelectedRecord(record);
    setRecordSession(value => value + 1);
    setModal('clarity-record');
  };
  const openRecordEditor = (record: ClarityRecord) => {
    setSelectedRecord(null);
    setEditingRecord(record);
    setClarityStep(1);
    setClaritySession(value => value + 1);
    setModal('clarity');
  };
  const handleRecordSaved = (_record: ClarityRecord) => {
    setEditingRecord(null);
    setClarityRevision(value => value + 1);
    setModal(null);
    setView('journey');
  };
  const handleRecordDeleted = async (id: string) => {
    await deleteClarityRecord(id);
    setSelectedRecord(null);
    setClarityRevision(value => value + 1);
    setModal(null);
  };
  const handleClearRecords = async () => {
    await clearClarityRecords();
    setSelectedRecord(null);
    setClarityRevision(value => value + 1);
    setModal(null);
  };
  const openDailyState = (record: DailyStateRecord | null) => {
    setSelectedDailyState(record);
    setDailyStateSession(value => value + 1);
    setModal('daily-state');
  };
  const handleDailyStateSaved = (_record: DailyStateRecord) => {
    setSelectedDailyState(null);
    setDailyStateRevision(value => value + 1);
    setModal(null);
  };
  const handleDailyStateDeleted = async (id: string) => {
    await deleteDailyStateRecord(id);
    setSelectedDailyState(null);
    setDailyStateRevision(value => value + 1);
    setModal(null);
  };
  const handleClearDailyStates = async () => {
    await clearDailyStateRecords();
    setSelectedDailyState(null);
    setDailyStateRevision(value => value + 1);
    setModal(null);
  };
  const handleExportRecords = async () => {
    const claritySections = clarityState.records.map((record, index) => {
      const fields = [
        `${index + 1}. ${formatClarityDate(record.createdAt, true)}`,
        `事实：${record.fact}`,
        `感受：${record.emotion}`,
        record.interpretation ? `解释：${record.interpretation}` : '',
        record.worry ? `担心：${record.worry}` : '',
        record.nextQuestion ? `下一步确认：${record.nextQuestion}` : '',
      ].filter(Boolean);
      return fields.join('\n');
    });
    const dailyStateSections = dailyStateState.records.map((record, index) => {
      const fields = [
        `${index + 1}. ${record.localDate}`,
        `能量：${record.energy}/5`,
        `压力：${record.stress}/5`,
        `感受：${record.emotion}`,
        `关注：${record.focusArea}`,
        record.importantEvent ? `重要事件：${record.importantEvent}` : '',
        record.note ? `备注：${record.note}` : '',
      ].filter(Boolean);
      return fields.join('\n');
    });
    const messageSections = [
      dailyStateSections.length ? `【每日状态】\n${dailyStateSections.join('\n\n')}` : '',
      claritySections.length ? `【事实梳理】\n${claritySections.join('\n\n')}` : '',
    ].filter(Boolean);
    await Share.share({
      title: '知时 · 本机现实记录',
      message: `知时 · 本机现实记录\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n${messageSections.join('\n\n')}`,
    });
  };
  useEffect(() => {
    getApiHealth().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
  }, []);
  return <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={colors.paper} /><View style={styles.app}><Header onSafety={() => setModal('safety')} onProfile={() => { setProfileSession(value => value + 1); setModal('profile'); }} apiOnline={apiOnline} /><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="always" automaticallyAdjustKeyboardInsets>{view === 'daily' ? <DailyScreen onClarity={openClarity} onBazi={() => setModal('bazi')} onOpenRecord={openRecord} onDailyState={openDailyState} latestRecord={clarityState.records[0] ?? null} todayState={todayState} dailyStateLoading={dailyStateState.loading} dailyStateError={dailyStateState.error} revision={chartRevision} /> : view === 'journey' ? <JourneyScreen records={clarityState.records} loading={clarityState.loading} error={clarityState.error} dailyStates={dailyStateState.records} dailyStatesLoading={dailyStateState.loading} dailyStatesError={dailyStateState.error} onClarity={openClarity} onOpenRecord={openRecord} onOpenDailyState={openDailyState} /> : <YearScreen onBazi={() => setModal('bazi')} revision={chartRevision} />}</ScrollView><TabBar view={view} setView={setView} onClarity={openClarity} onBazi={() => setModal('bazi')} />
    <Modal visible={modal === 'clarity'} transparent animationType="slide" onRequestClose={() => setModal(null)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><ClaritySheet key={claritySession} step={clarityStep} setStep={setClarityStep} initialRecord={editingRecord} onClose={() => { setEditingRecord(null); setModal(null); }} onSaved={handleRecordSaved} /></KeyboardAvoidingView></Modal>
    <Modal visible={modal === 'clarity-record'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}>{selectedRecord ? <ClarityRecordSheet key={`${selectedRecord.id}-${recordSession}`} record={selectedRecord} onClose={() => setModal(null)} onEdit={openRecordEditor} onDelete={handleRecordDeleted} /> : null}</View></Modal>
    <Modal visible={modal === 'daily-state'} transparent animationType="slide" onRequestClose={() => setModal(null)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><DailyStateSheet key={dailyStateSession} record={selectedDailyState} onClose={() => setModal(null)} onSaved={handleDailyStateSaved} onDelete={handleDailyStateDeleted} /></KeyboardAvoidingView></Modal>
    <Modal visible={modal === 'safety'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}><SafetySheet onClose={() => setModal(null)} /></View></Modal>
    <Modal visible={modal === 'profile'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}><ProfileSheet key={`profile-${profileSession}-${clarityRevision}-${dailyStateRevision}`} onClose={() => setModal(null)} onOpenBazi={() => setModal('bazi')} recordCount={clarityState.records.length} dailyStateCount={dailyStateState.records.length} onExportRecords={handleExportRecords} onClearRecords={handleClearRecords} onClearDailyStates={handleClearDailyStates} /></View></Modal>
    <Modal visible={modal === 'bazi'} transparent animationType="slide" onRequestClose={() => setModal(null)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><BaziSheet onClose={() => setModal(null)} onChartStorageChange={() => setChartRevision(value => value + 1)} /></KeyboardAvoidingView></Modal>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  inputVoiceHint: { color: '#989B94', fontSize: 9, lineHeight: 15, marginTop: 6 },
  safeArea: { flex: 1, backgroundColor: colors.paper }, app: { flex: 1, backgroundColor: colors.paper }, scrollContent: { padding: 20, paddingBottom: 30 }, header: { height: 66, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brandLine: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: colors.paper, fontSize: 18, fontWeight: '700' }, brandName: { color: colors.ink, fontSize: 17, fontWeight: '700' }, brandSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headerIcon: { padding: 8 }, profileChip: { flexDirection: 'row', alignItems: 'center', gap: 6 }, avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#D2D9C7', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.sageDeep, fontSize: 12 }, profileName: { color: colors.ink, fontSize: 11 }, chevron: { color: colors.muted, fontSize: 15 }, heading: { paddingTop: 18, marginBottom: 24 }, eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.2 }, pageTitle: { color: colors.ink, fontSize: 30, fontWeight: '600', marginTop: 11, letterSpacing: -1 }, pageSubtitle: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 19 }, rowCards: { gap: 14 }, card: { borderWidth: 1, borderColor: colors.line, borderRadius: 21, backgroundColor: colors.card, padding: 19, shadowColor: '#514F43', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 }, focusCard: { backgroundColor: '#FFFDF8' }, stateCard: { backgroundColor: '#F2F2EA' }, kicker: { flexDirection: 'row', alignItems: 'center', gap: 7 }, kickerDot: { width: 6, height: 6, borderRadius: 3 }, kickerText: { color: '#858981', fontSize: 9, letterSpacing: 0.9, textTransform: 'uppercase' }, focusTitle: { color: colors.ink, fontSize: 22, fontWeight: '600', lineHeight: 31, marginTop: 27, letterSpacing: -0.6 }, bodyText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 11 }, noteBox: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 28, paddingTop: 14 }, noteLabel: { color: colors.terracotta, fontSize: 9, marginBottom: 6 }, noteText: { color: colors.ink, fontSize: 13, lineHeight: 21, fontWeight: '500' }, evidenceWrap: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 17, paddingTop: 11 }, evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 }, evidenceGlyph: { color: colors.sageDeep, fontSize: 14 }, evidenceLabel: { flex: 1, color: '#888C83', fontSize: 10 }, evidenceChevron: { color: '#AAA9A1', fontSize: 15 }, evidenceBody: { marginTop: 12, gap: 7 }, evidenceSource: { backgroundColor: '#F0EFE8', borderRadius: 10, padding: 10 }, evidenceSourceTitle: { color: '#6C7269', fontSize: 9, fontWeight: '600' }, evidenceSourceText: { color: '#999B93', fontSize: 9, lineHeight: 15, marginTop: 4 }, evidenceSummary: { color: '#747971', fontSize: 11, lineHeight: 18, marginTop: 3 }, evidenceMeta: { flexDirection: 'row', justifyContent: 'space-between' }, evidenceMetaText: { color: '#9A9D94', fontSize: 8 }, cardTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, textButton: { color: '#7F857C', fontSize: 10 }, orbit: { height: 170, alignItems: 'center', justifyContent: 'center', position: 'relative' }, orbitRingOne: { position: 'absolute', width: 184, height: 108, borderRadius: 92, borderWidth: 1, borderColor: 'rgba(137,155,125,0.25)', transform: [{ rotate: '-24deg' }] }, orbitRingTwo: { position: 'absolute', width: 220, height: 144, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(196,161,95,0.22)', transform: [{ rotate: '28deg' }] }, orbitCenter: { width: 75, height: 75, borderRadius: 38, backgroundColor: '#FFFEFA', alignItems: 'center', justifyContent: 'center', elevation: 2 }, orbitScore: { color: colors.ink, fontSize: 24, fontWeight: '600' }, orbitLabel: { color: colors.muted, fontSize: 9, marginTop: 3 }, metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }, metricTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DFE0D5', overflow: 'hidden' }, metricValue: { height: 4, borderRadius: 2 }, metricLabel: { width: 35, color: '#6F746C', fontSize: 9 }, metricValueText: { width: 28, color: '#A0A29A', fontSize: 9, textAlign: 'right' }, stateFooter: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 16, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }, trend: { color: colors.sageDeep }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 34, marginBottom: 14 }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginTop: 8, letterSpacing: -0.4 }, estimate: { color: '#A1A39B', fontSize: 9 }, actionRow: { flexDirection: 'row', gap: 14 }, actionNumber: { color: '#C2C5BD', fontSize: 13, paddingTop: 3 }, actionCopy: { flex: 1 }, actionType: { color: colors.terracotta, fontSize: 9 }, actionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 7 }, primaryButton: { marginTop: 18, borderRadius: 11, backgroundColor: colors.ink, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, primaryButtonDone: { backgroundColor: colors.sageDeep }, primaryButtonLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' }, primaryButtonArrow: { color: '#FFF', fontSize: 15 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }, twoCardRow: { gap: 14, marginTop: 27 }, clarityCard: { backgroundColor: '#E9EEEA' }, chapterCard: { backgroundColor: '#FFFEFA' }, quickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 42 }, quickTitle: { color: colors.ink, fontSize: 19, fontWeight: '600' }, quickText: { color: '#778078', fontSize: 10, marginTop: 6 }, arrowButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(88,109,84,0.22)', alignItems: 'center', justifyContent: 'center' }, arrowButtonText: { color: colors.sageDeep, fontSize: 17 }, chapterStatus: { color: colors.lilac, fontSize: 9, marginTop: 17 }, chapterTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 21, marginTop: 7 }, chapterText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 }, mirrorStrip: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 22, marginTop: 28 }, mirrorTitle: { color: colors.ink, fontSize: 17, fontWeight: '600', marginTop: 9 }, chart: { height: 44, flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 17, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 8 }, chartBar: { width: 8, minHeight: 5, backgroundColor: '#C7D2C2', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartBarCurrent: { backgroundColor: colors.sageDeep }, journeyHero: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#F2F5ED' }, journeyTitle: { color: colors.ink, fontSize: 22, fontWeight: '600', lineHeight: 30, marginTop: 14, marginBottom: 2 }, progressCircle: { width: 94, height: 94, borderRadius: 47, borderWidth: 1, borderColor: 'rgba(88,109,84,0.28)', alignItems: 'center', justifyContent: 'center' }, progressNumber: { color: colors.ink, fontSize: 20, fontWeight: '600' }, progressLabel: { color: colors.muted, fontSize: 8, marginTop: 4 }, timelineItem: { flexDirection: 'row', gap: 13, paddingBottom: 25 }, timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#C4C8BF', marginTop: 5 }, timelineDotActive: { backgroundColor: colors.terracotta }, timelineContent: { flex: 1 }, timelineLabel: { color: '#999D94', fontSize: 8 }, timelineTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 7 }, timelineText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 }, smallButton: { alignSelf: 'flex-start', backgroundColor: '#EFF2EB', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11, marginTop: 12 }, smallButtonText: { color: colors.sageDeep, fontSize: 10 }, conditionsCard: { marginTop: 2 }, conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, conditionNumber: { color: '#B8C1B3', fontSize: 9 }, conditionText: { color: colors.ink, fontSize: 13 }, bottomNotice: { backgroundColor: '#EEEFE7', borderRadius: 15, padding: 17, marginTop: 26 }, noticeText: { color: '#777D74', fontSize: 12, lineHeight: 19, marginTop: 7 }, secondaryButton: { backgroundColor: colors.ink, borderRadius: 10, padding: 12, marginTop: 14, alignItems: 'center' }, secondaryButtonText: { color: '#FFF', fontSize: 10 }, yearHero: { backgroundColor: '#FAF2E8', paddingBottom: 20 }, yearTitle: { color: colors.ink, fontSize: 23, fontWeight: '600', lineHeight: 31, marginTop: 17 }, tagRow: { flexDirection: 'row', gap: 7, marginTop: 17 }, tag: { color: '#827663', backgroundColor: '#FFFDF8', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, fontSize: 8 }, yearCore: { alignSelf: 'center', width: 94, height: 94, borderRadius: 47, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', marginTop: 20 }, yearCoreNumber: { color: colors.ink, fontSize: 20, fontWeight: '600' }, yearCoreLabel: { color: colors.muted, fontSize: 8, marginTop: 4 }, quarterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, quarterCard: { width: '48%', minHeight: 145, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 14, backgroundColor: 'rgba(255,255,252,0.5)' }, quarterActive: { borderColor: 'rgba(199,122,89,0.35)', backgroundColor: '#FAF2E8' }, quarterTitle: { color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 14 }, quarterText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 }, quarterLine: { height: 3, borderRadius: 3, backgroundColor: '#E1E2DA', marginTop: 18 }, quarterLineDone: { backgroundColor: colors.sage }, quarterLineActive: { backgroundColor: colors.terracotta }, domainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 26 }, domainCard: { width: '31.7%', minHeight: 115, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: colors.card }, domainIcon: { color: colors.sageDeep, fontSize: 18 }, domainLabel: { color: '#969A91', fontSize: 8, marginTop: 8 }, domainTitle: { color: colors.ink, fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 5 }, monthCard: { marginTop: 27 }, monthRow: { gap: 9, marginTop: 18 }, monthItem: { backgroundColor: '#F2F1E9', borderRadius: 12, padding: 13, minHeight: 55 }, monthItemActive: { backgroundColor: '#E8EEE4', borderWidth: 1, borderColor: '#D4DFCF' }, monthNumber: { color: '#B2B8AC', fontSize: 13 }, monthTitle: { color: colors.ink, fontSize: 13, fontWeight: '600', position: 'absolute', left: 48, top: 12 }, monthText: { color: colors.muted, fontSize: 9, position: 'absolute', left: 48, top: 32 }, tabBar: { height: 68, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: 'rgba(249,248,243,0.97)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 }, tabItem: { flex: 1, alignItems: 'center', gap: 3 }, tabIcon: { color: '#9B9F96', fontSize: 18 }, tabLabel: { color: '#9B9F96', fontSize: 9 }, tabActive: { color: colors.ink }, centerTab: { flex: 1, alignItems: 'center', marginTop: -24 }, centerTabIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, color: '#FFF', textAlign: 'center', lineHeight: 35, fontSize: 16, borderWidth: 4, borderColor: colors.paper, overflow: 'hidden' }, centerTabLabel: { color: colors.sageDeep, fontSize: 9, marginTop: 2 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(39,43,39,0.35)', justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: '#F9F8F3', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 19, paddingHorizontal: 20, paddingBottom: 25 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }, sheetHeaderTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' }, closeText: { color: '#989C92', fontSize: 25, lineHeight: 25 }, sheetContent: { paddingBottom: 12 }, sheetProgress: { flexDirection: 'row', gap: 5, marginBottom: 27 }, sheetProgressBar: { height: 3, flex: 1, borderRadius: 2, backgroundColor: '#E3E4DC' }, sheetProgressActive: { backgroundColor: colors.sageDeep }, sheetEyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.1, marginTop: 4 }, sheetTitle: { color: colors.ink, fontSize: 25, fontWeight: '600', lineHeight: 33, marginTop: 12, letterSpacing: -0.5 }, sheetSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 9, marginBottom: 17 }, textArea: { minHeight: 125, borderWidth: 1, borderColor: 'rgba(43,48,43,0.2)', borderRadius: 13, padding: 14, color: colors.ink, fontSize: 12, textAlignVertical: 'top', backgroundColor: '#FFFDF8' }, emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, emotionButton: { width: '23%', paddingVertical: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center', backgroundColor: '#FFFDF8' }, emotionSelected: { backgroundColor: '#E8EEE4', borderColor: '#CCDAC6' }, triadItem: { backgroundColor: '#F0F0E9', borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#CBD4C5' }, triadLabel: { color: '#8C9188', fontSize: 8, letterSpacing: 0.3 }, triadText: { color: '#686E66', fontSize: 11, lineHeight: 17, marginTop: 5 }, recommendation: { backgroundColor: '#E7EEE4', borderRadius: 12, padding: 14, marginTop: 14 }, recommendationTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 21, marginTop: 7 }, choiceRow: { marginTop: 21 }, choiceHeader: { flexDirection: 'row', justifyContent: 'space-between' }, choiceLabel: { color: '#737970', fontSize: 12 }, choiceValue: { color: colors.sageDeep, fontSize: 12 }, choiceButtons: { flexDirection: 'row', gap: 8, marginTop: 10 }, choiceButton: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }, choiceButtonActive: { backgroundColor: '#E8EEE4', borderColor: '#CCDAC6' }, safetyIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#E8EEE4', alignItems: 'center', justifyContent: 'center', marginTop: 6 }, safetyItem: { color: '#6E766B', fontSize: 11, marginTop: 13 },
  disabled: { opacity: 0.62 },
  legalNoticeCard: { borderWidth: 1, borderColor: 'rgba(199,122,89,0.24)', borderRadius: 13, backgroundColor: '#FAF2E8', padding: 14, marginTop: 20 }, legalNoticeTitle: { color: colors.terracotta, fontSize: 11, fontWeight: '700' }, legalNoticeText: { color: '#756B5E', fontSize: 10, lineHeight: 17, marginTop: 8 },
  yearLoadingCard: { alignItems: 'center', gap: 12, paddingVertical: 34 }, yearLoadingText: { color: colors.muted, fontSize: 11 },
  yearEmptyCard: { backgroundColor: '#FAF2E8' }, yearErrorCard: { backgroundColor: '#FFF7F2', borderColor: 'rgba(199,122,89,0.3)' }, yearEmptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '600', lineHeight: 29, marginTop: 20 }, yearEmptyText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 10 },
  yearVerifiedHero: { backgroundColor: '#FAF2E8' }, yearVerifiedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, yearAuditChip: { backgroundColor: '#E3ECE0', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 }, yearAuditChipText: { color: colors.sageDeep, fontSize: 8, fontWeight: '700' }, yearPillar: { color: colors.ink, fontSize: 52, fontWeight: '600', letterSpacing: 7, textAlign: 'center', marginTop: 27 }, yearLayerNote: { color: '#8D806D', fontSize: 9, textAlign: 'center', marginTop: 8 },
  yearBoundaryGrid: { gap: 9, marginTop: 25 }, yearBoundaryItem: { backgroundColor: 'rgba(255,253,248,0.85)', borderRadius: 12, padding: 12 }, yearBoundaryLabel: { color: colors.terracotta, fontSize: 9, fontWeight: '600' }, yearBoundaryValue: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 5 },
  yearCycleGrid: { gap: 11, marginTop: 13 }, yearCycleCard: { minHeight: 155 }, yearCyclePillar: { color: colors.ink, fontSize: 28, fontWeight: '600', letterSpacing: 3, marginTop: 20 }, yearCycleMeta: { color: colors.sageDeep, fontSize: 10, fontWeight: '600', marginTop: 8 }, yearCycleDetail: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 7 },
  yearAuditCard: { marginTop: 13, backgroundColor: '#F2F5ED' }, yearAuditTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 23, marginTop: 16 }, yearAuditText: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 7 },
  yearInterpretationNotice: { backgroundColor: '#EEEFE7', borderRadius: 15, padding: 17, marginTop: 13 }, yearInterpretationTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 23, marginTop: 12 }, yearInterpretationText: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 7 },
  interpretationWrap: { marginTop: 13, gap: 13 }, interpretationRequestCard: { backgroundColor: '#F3F0E8' }, interpretationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, aiChip: { color: '#7D6A45', backgroundColor: '#F2E5C9', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 8, fontWeight: '700' }, interpretationRequestTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', lineHeight: 27, marginTop: 18 }, interpretationRequestText: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 8 },
  interpretationFocusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }, interpretationFocusButton: { width: '48%', minHeight: 39, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, interpretationFocusActive: { borderColor: '#CCB77F', backgroundColor: '#F8EDD5' }, interpretationFocusText: { color: colors.muted, fontSize: 10 }, interpretationFocusTextActive: { color: '#745F36', fontWeight: '700' }, interpretationQuestion: { minHeight: 88, borderWidth: 1, borderColor: 'rgba(43,48,43,0.16)', borderRadius: 11, padding: 12, color: colors.ink, fontSize: 11, lineHeight: 17, textAlignVertical: 'top', backgroundColor: colors.card },
  aiDisclosureCard: { borderRadius: 11, backgroundColor: '#E8ECE4', padding: 12, marginTop: 13 }, aiDisclosureTitle: { color: colors.sageDeep, fontSize: 9, fontWeight: '700' }, aiDisclosureText: { color: '#6F786B', fontSize: 9, lineHeight: 15, marginTop: 5 }, interpretationError: { borderRadius: 10, backgroundColor: '#F8E9E4', padding: 11, marginTop: 12 }, interpretationErrorText: { color: '#9C543E', fontSize: 9, lineHeight: 15 }, interpretationGenerateButton: { minHeight: 45, borderRadius: 11, backgroundColor: colors.ink, paddingHorizontal: 14, marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 }, interpretationGenerateText: { flex: 1, color: '#FFF', fontSize: 11, fontWeight: '700' }, interpretationTransient: { color: '#989B94', fontSize: 8, textAlign: 'center', marginTop: 10 },
  interpretationResultCard: { backgroundColor: '#FFFEFA' }, interpretationSummary: { color: colors.ink, fontSize: 17, fontWeight: '600', lineHeight: 26, marginTop: 20 }, interpretationSection: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 20, paddingTop: 18 }, interpretationSectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, interpretationSectionText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 8 }, interpretationEvidenceLabel: { color: colors.sageDeep, fontSize: 8, fontWeight: '700', marginTop: 13 }, interpretationEvidenceList: { gap: 7, marginTop: 7 }, interpretationEvidenceItem: { borderRadius: 9, backgroundColor: '#F0F1EA', padding: 9 }, interpretationEvidenceTitle: { color: colors.sageDeep, fontSize: 8, fontWeight: '700' }, interpretationEvidenceValue: { color: colors.muted, fontSize: 8, lineHeight: 14, marginTop: 4 }, interpretationQuestionText: { color: '#786947', backgroundColor: '#F8F0DE', borderRadius: 9, padding: 10, fontSize: 9, lineHeight: 15, marginTop: 8 }, interpretationNotice: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 18, paddingTop: 14 }, interpretationNoticeTitle: { color: colors.terracotta, fontSize: 9, fontWeight: '700' }, interpretationNoticeText: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 5 }, interpretationCaution: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 5 }, interpretationMeta: { color: '#A1A39B', fontSize: 7, lineHeight: 12, textAlign: 'center', marginTop: 17 },
  scoreDots: { flexDirection: 'row', gap: 5, marginTop: 9 }, scoreDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#CDD1C8', backgroundColor: '#F8F7F2' },
  todayStateLoading: { alignItems: 'center', gap: 12, paddingVertical: 28, backgroundColor: '#F2F5ED' }, todayStateEmpty: { backgroundColor: '#EEF3EB', marginBottom: 13 }, todayStateCard: { backgroundColor: '#EEF3EB', marginBottom: 13 }, todayStateTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, todayStateSaved: { color: colors.sageDeep, backgroundColor: '#DDE8D8', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 8, fontWeight: '700' }, todayStateTitle: { color: colors.ink, fontSize: 21, fontWeight: '600', lineHeight: 29, marginTop: 18 }, todayStateText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 9 }, todayStateMetrics: { flexDirection: 'row', gap: 11, marginTop: 18 }, todayStateMetric: { flex: 1, borderRadius: 12, backgroundColor: '#FFFDF8', padding: 12 }, todayStateMetricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, todayStateMetricLabel: { color: colors.muted, fontSize: 9 }, todayStateMetricValue: { color: colors.ink, fontSize: 12, fontWeight: '700' }, todayStateEvent: { color: '#687064', fontSize: 10, lineHeight: 17, backgroundColor: '#E3EBDD', borderRadius: 10, padding: 10, marginTop: 12 }, todayStateEdit: { color: colors.sageDeep, fontSize: 9, fontWeight: '700', marginTop: 15 },
  todayEmptyCard: { backgroundColor: '#FAF2E8' }, todayEmptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '600', lineHeight: 29, marginTop: 20 }, todayEmptyText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 10 },
  todayCycleHero: { backgroundColor: '#FAF2E8' }, todayCycleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, todayVerified: { color: colors.sageDeep, backgroundColor: '#E3ECE0', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 8, fontWeight: '700' }, todayPillarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 25 }, todayPillarItem: { flex: 1, alignItems: 'center' }, todayPillarLabel: { color: colors.muted, fontSize: 9 }, todayPillarValue: { color: colors.ink, fontSize: 31, fontWeight: '600', letterSpacing: 4, marginTop: 8 }, todayPillarMeta: { color: colors.terracotta, fontSize: 8, marginTop: 5 }, todayPillarDivider: { width: 1, height: 70, backgroundColor: 'rgba(199,122,89,0.18)' }, todayBoundaryBox: { backgroundColor: 'rgba(255,253,248,0.88)', borderRadius: 12, padding: 12, marginTop: 22 }, todayBoundaryLabel: { color: colors.terracotta, fontSize: 9, fontWeight: '600' }, todayBoundaryValue: { color: colors.ink, fontSize: 11, marginTop: 6 },
  todayChartCard: { marginTop: 13, backgroundColor: '#F2F5ED' }, todayChartPillars: { flexDirection: 'row', gap: 7, marginTop: 17 }, todayChartPillar: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: 11, paddingVertical: 11 }, todayChartLabel: { color: colors.muted, fontSize: 8 }, todayChartValue: { color: colors.ink, fontSize: 17, fontWeight: '600', marginTop: 7 }, todayEvidence: { color: colors.muted, fontSize: 8, textAlign: 'center', marginTop: 10 }, todayTextButton: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 10, marginTop: 6 }, todayTextButtonLabel: { color: colors.sageDeep, fontSize: 9, fontWeight: '600' }, todayClarityCard: { marginTop: 13, backgroundColor: '#E9EEEA' },
  latestRecordCard: { marginTop: 13, backgroundColor: '#F2F1F5' }, latestRecordDate: { color: colors.muted, fontSize: 9, marginTop: 15 }, latestRecordFact: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 24, marginTop: 9 }, latestRecordFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }, latestRecordEmotion: { color: '#6E6280', backgroundColor: '#E7E1EE', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, fontSize: 9, fontWeight: '600' }, latestRecordLink: { color: colors.sageDeep, fontSize: 10, fontWeight: '600' },
  stateOverviewLoading: { alignItems: 'center', gap: 12, paddingVertical: 28, backgroundColor: '#EEF2F3', marginBottom: 13 }, stateOverviewEmpty: { backgroundColor: '#EEF2F3', marginBottom: 13 }, stateOverviewCard: { backgroundColor: '#EEF2F3', marginBottom: 13 }, stateOverviewTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', lineHeight: 27, marginTop: 15 }, stateOverviewText: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 8 }, stateOverviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, stateOverviewCount: { color: '#607A7F', fontSize: 31, fontWeight: '600', lineHeight: 36 }, stateOverviewCountUnit: { fontSize: 10, fontWeight: '500' }, stateAverageRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: '#FFFDF8', paddingVertical: 13, marginTop: 16 }, stateAverageItem: { flex: 1, alignItems: 'center' }, stateAverageLabel: { color: colors.muted, fontSize: 8 }, stateAverageValue: { color: colors.ink, fontSize: 21, fontWeight: '600', marginTop: 6 }, stateAverageDivider: { width: 1, height: 35, backgroundColor: colors.line }, stateTrendChart: { height: 78, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#D5DBD9', paddingHorizontal: 5, marginTop: 18 }, stateTrendColumn: { flex: 1, alignItems: 'center' }, stateTrendBars: { height: 43, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }, stateTrendBar: { width: 5, minHeight: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3 }, stateTrendEnergy: { backgroundColor: colors.sageDeep }, stateTrendStress: { backgroundColor: colors.terracotta }, stateTrendDay: { color: '#909894', fontSize: 7, marginTop: 5, marginBottom: 4 }, stateTrendLegend: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }, stateTrendLegendEnergy: { color: colors.sageDeep, fontSize: 8 }, stateTrendLegendStress: { color: colors.terracotta, fontSize: 8 }, stateTrendLimit: { flex: 1, color: '#9AA09C', fontSize: 7, textAlign: 'right' }, stateRecentList: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 16 }, stateRecentRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 9 }, stateRecentDate: { color: colors.muted, fontSize: 8 }, stateRecentTitle: { color: colors.ink, fontSize: 11, fontWeight: '600', marginTop: 5 }, stateRecentScores: { flexDirection: 'row', alignItems: 'center', gap: 6 }, stateRecentEnergy: { color: colors.sageDeep, backgroundColor: '#E3EBDF', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, fontSize: 8, fontWeight: '700' }, stateRecentStress: { color: colors.terracotta, backgroundColor: '#F5E5DE', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, fontSize: 8, fontWeight: '700' }, stateRecentArrow: { color: '#89908B', fontSize: 13 },
  journeyEmptyCard: { backgroundColor: '#F2F1F5' }, journeyEmptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '600', lineHeight: 29, marginTop: 20 }, journeyEmptyText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 10 }, journeyPrinciples: { gap: 10, marginTop: 14 }, journeyPrinciple: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.card, padding: 15 }, journeyPrincipleNumber: { color: colors.lilac, fontSize: 9 }, journeyPrincipleTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 8 }, journeyPrincipleText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  journeySummaryCard: { backgroundColor: '#F2F5ED' }, journeySummaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, journeySummaryCopy: { flex: 1 }, journeySummaryTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', lineHeight: 27, marginTop: 15 }, journeySummaryNumber: { color: colors.sageDeep, fontSize: 38, fontWeight: '600', lineHeight: 42 }, journeySummaryText: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 11 }, journeyToolsCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: '#FFFDF8', padding: 14, marginTop: 14 }, journeySearchRow: { minHeight: 46, borderRadius: 12, backgroundColor: '#F0F0E9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, journeySearchIcon: { color: '#7C8279', fontSize: 19, marginRight: 8 }, journeySearchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 12, paddingVertical: 9 }, journeySearchClear: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, journeySearchClearText: { color: '#8C9188', fontSize: 20 }, journeyEmotionFilters: { gap: 7, paddingTop: 12, paddingBottom: 3 }, journeyFilterChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFDF8', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' }, journeyFilterChipActive: { borderColor: '#CBD8C5', backgroundColor: '#E7EEE4' }, journeyFilterChipText: { color: '#777D74', fontSize: 10, fontWeight: '500' }, journeyFilterChipTextActive: { color: colors.sageDeep, fontWeight: '700' }, journeyResultCount: { color: '#969A91', fontSize: 9, marginTop: 10 }, journeyRecordList: { marginTop: 14 }, journeyTimelineRow: { flexDirection: 'row', alignItems: 'stretch' }, journeyTimelineRail: { width: 24, alignItems: 'center' }, journeyTimelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.sageDeep, marginTop: 21 }, journeyTimelineLine: { flex: 1, width: 1, minHeight: 18, backgroundColor: '#D9DDD4', marginVertical: 4 }, journeyRecordCard: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.card, padding: 17, marginBottom: 12 }, journeyRecordMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, journeyRecordDate: { color: colors.muted, fontSize: 9 }, journeyRecordEmotion: { color: '#6E6280', backgroundColor: '#EEEAF2', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '600' }, journeyRecordFact: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 23, marginTop: 12 }, journeyRecordQuestion: { color: '#6A725F', backgroundColor: '#EEF1E9', borderRadius: 10, padding: 10, fontSize: 10, lineHeight: 16, marginTop: 11 }, journeyRecordOpen: { color: colors.sageDeep, fontSize: 9, fontWeight: '600', marginTop: 13 }, journeyNoResults: { marginTop: 14, backgroundColor: '#F5F3EE' }, journeyNoResultsTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' }, journeyNoResultsText: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 8 }, journeyResetButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', marginTop: 10 }, journeyResetButtonText: { color: colors.sageDeep, fontSize: 10, fontWeight: '700' },
  recordUpdatedAt: { color: '#92968E', fontSize: 9, marginTop: 7 }, recordDetailTitle: { color: colors.ink, fontSize: 23, fontWeight: '600', lineHeight: 31, marginTop: 13 }, recordDetailList: { gap: 10 }, recordDetailItem: { borderRadius: 13, backgroundColor: '#F0F0E9', padding: 14, borderLeftWidth: 3, borderLeftColor: '#CBD4C5' }, recordDetailLabel: { color: '#7C8279', fontSize: 9, fontWeight: '600' }, recordDetailValue: { color: colors.ink, fontSize: 12, lineHeight: 20, marginTop: 7 }, localOnlyNotice: { borderRadius: 13, backgroundColor: '#E8EEE4', padding: 14, marginTop: 16 }, localOnlyTitle: { color: colors.sageDeep, fontSize: 10, fontWeight: '700' }, localOnlyText: { color: '#6F786B', fontSize: 10, lineHeight: 17, marginTop: 6 },
  settingsDataCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.card, padding: 15, marginTop: 12 }, settingsDataLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' }, settingsDataValue: { color: colors.ink, fontSize: 20, fontWeight: '600', marginTop: 9 }, settingsDataText: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 7 }, dangerTextButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, dangerTextButtonLabel: { color: '#A34F3B', fontSize: 11, fontWeight: '600' }, deleteConfirmCard: { borderWidth: 1, borderColor: 'rgba(163,79,59,0.24)', borderRadius: 14, backgroundColor: '#FAECE7', padding: 14, marginTop: 14 }, deleteConfirmTitle: { color: '#8F4534', fontSize: 14, fontWeight: '700' }, deleteConfirmText: { color: '#8C645A', fontSize: 10, lineHeight: 16, marginTop: 6 }, deleteConfirmActions: { flexDirection: 'row', gap: 9, marginTop: 13 }, deleteCancelButton: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(43,48,43,0.16)', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, deleteCancelLabel: { color: colors.ink, fontSize: 10, fontWeight: '600' }, deleteButton: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9A4D3A' }, deleteButtonLabel: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  stateScaleBlock: { borderRadius: 14, backgroundColor: '#F0F0E9', padding: 14, marginTop: 12 }, stateScaleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, stateScaleLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' }, stateScaleValue: { color: colors.muted, fontSize: 10 }, stateScaleButtons: { flexDirection: 'row', gap: 8, marginTop: 12 }, stateScaleButton: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' }, stateScaleButtonText: { color: colors.ink, fontSize: 12, fontWeight: '600' }, stateScaleButtonTextActive: { color: '#FFF' }, stateScaleEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }, stateScaleEndText: { color: '#989C94', fontSize: 8 }, stateFieldLabel: { color: '#737970', fontSize: 10, fontWeight: '600', marginTop: 18, marginBottom: 8 }, stateChoiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stateChoiceButton: { width: '23%', minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' }, stateChoiceSelected: { borderColor: '#C7D7C2', backgroundColor: '#E4EDE0' }, stateChoiceText: { color: '#6F756D', fontSize: 10 }, stateChoiceTextSelected: { color: colors.sageDeep, fontWeight: '700' }, stateFocusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stateFocusButton: { width: '48%', minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' },
  stepBackButton: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: -10, marginBottom: 6 }, stepBackButtonText: { color: colors.sageDeep, fontSize: 10, fontWeight: '600' }, clarityFieldLabel: { color: '#737970', fontSize: 10, marginTop: 14, marginBottom: 7 }, clarityInput: { minHeight: 70, borderWidth: 1, borderColor: 'rgba(43,48,43,0.18)', borderRadius: 11, padding: 12, color: colors.ink, fontSize: 11, lineHeight: 17, textAlignVertical: 'top', backgroundColor: '#FFFDF8' },
});
