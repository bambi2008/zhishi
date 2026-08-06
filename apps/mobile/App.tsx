import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiHealth } from './src/api';

type ViewKey = 'daily' | 'journey' | 'year';
type ModalKey = 'clarity' | 'status' | 'safety' | 'profile' | null;

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

const evidenceCopy = {
  daily: {
    title: '为什么这么判断？',
    sources: [
      ['周期背景', '当前周期先观察后判断，真实四柱计算待引擎接入。'],
      ['近期状态', '最近几次在等待回复时，重复搜索多于收集新信息。'],
      ['现实输入', '今天的重点是等待一条工作相关回应。'],
    ],
    summary: '今天更有价值的不是快速下结论，而是把没有信息与坏结果分开。',
  },
  action: {
    title: '为什么是这个行动？',
    sources: [
      ['现实事实', '行动直接对应今天的等待和模糊回应。'],
      ['历史反馈', '此前收集事实后，清晰度平均上升。'],
    ],
    summary: '这是一个 15 分钟内可验证、不会锁死后续选择的小动作。',
  },
  year: {
    title: '为什么这么判断？',
    sources: [
      ['年度背景', '年度主线是先重建结构，再选择扩张。'],
      ['当前章节', '工作章节正在验证替代路径的真实性。'],
      ['现实计划', '接下来适合进行一次低风险、可逆的外部试探。'],
    ],
    summary: 'Q3 的重点不是必须改变，而是让成熟判断进入一次可逆试行。',
  },
} as const;

function Kicker({ label, color = colors.sage }: { label: string; color?: string }) {
  return <View style={styles.kicker}><View style={[styles.kickerDot, { backgroundColor: color }]} /><Text style={styles.kickerText}>{label}</Text></View>;
}

function ArrowButton({ label = '→', onPress }: { label?: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.arrowButton, pressed && styles.pressed]}><Text style={styles.arrowButtonText}>{label}</Text></Pressable>;
}

function PrimaryButton({ label, onPress, done = false }: { label: string; onPress: () => void; done?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, done && styles.primaryButtonDone, pressed && styles.pressed]}><Text style={styles.primaryButtonLabel}>{label}</Text><Text style={styles.primaryButtonArrow}>{done ? '✓' : '→'}</Text></Pressable>;
}

function EvidenceRow({ kind = 'daily' }: { kind?: keyof typeof evidenceCopy }) {
  const [open, setOpen] = useState(false);
  const data = evidenceCopy[kind];
  return (
    <View style={styles.evidenceWrap}>
      <Pressable onPress={() => setOpen(!open)} style={styles.evidenceToggle}><Text style={styles.evidenceGlyph}>⌘</Text><Text style={styles.evidenceLabel}>{data.title}</Text><Text style={styles.evidenceChevron}>{open ? '⌃' : '⌄'}</Text></Pressable>
      {open && <View style={styles.evidenceBody}>
        {data.sources.map(([title, text]) => <View key={title} style={styles.evidenceSource}><Text style={styles.evidenceSourceTitle}>{title}</Text><Text style={styles.evidenceSourceText}>{text}</Text></View>)}
        <Text style={styles.evidenceSummary}>{data.summary}</Text>
        <View style={styles.evidenceMeta}><Text style={styles.evidenceMetaText}>可信度</Text><Text style={styles.evidenceMetaText}>中 · 信息仍可更新</Text></View>
      </View>}
    </View>
  );
}

function Header({ onSafety, onProfile, apiOnline }: { onSafety: () => void; onProfile: () => void; apiOnline: boolean }) {
  return <View style={styles.header}>
    <View style={styles.brandLine}><View style={styles.brandMark}><Text style={styles.brandMarkText}>知</Text></View><View><Text style={styles.brandName}>知时</Text><Text style={styles.brandSubtitle}>{apiOnline ? '东方人生导航 · 已连接' : '东方人生导航'}</Text></View></View>
    <View style={styles.headerRight}><Pressable onPress={onSafety} style={styles.headerIcon}><Text>♡</Text></Pressable><Pressable onPress={onProfile} style={styles.profileChip}><View style={styles.avatar}><Text style={styles.avatarText}>林</Text></View><Text style={styles.profileName}>林遥</Text><Text style={styles.chevron}>⌄</Text></Pressable></View>
  </View>;
}

function DailyScreen({ onClarity, onStatus }: { onClarity: () => void; onStatus: () => void }) {
  const [done, setDone] = useState(false);
  return <View>
    <View style={styles.heading}><Text style={styles.eyebrow}>2026 年 8 月 6 日 · 星期四</Text><Text style={styles.pageTitle}>早上好，林遥。</Text><Text style={styles.pageSubtitle}>今天，先把一个不确定的地方照亮。</Text></View>
    <View style={styles.rowCards}>
      <View style={[styles.card, styles.focusCard]}>
        <Kicker label="今日定向" /><Text style={styles.focusTitle}>不必急着证明，先收集一个事实。</Text><Text style={styles.bodyText}>你今天可能对模糊的回应更敏感，容易在信息还没齐的时候提前推演结果。把判断往后放一点，真正重要的信号才会浮出来。</Text><View style={styles.noteBox}><Text style={styles.noteLabel}>今天的安定句</Text><Text style={styles.noteText}>不需要一次想清全部，只要确认下一件真实发生的事。</Text></View><EvidenceRow kind="daily" />
      </View>
      <View style={[styles.card, styles.stateCard]}>
        <View style={styles.cardTopline}><Kicker label="现在的状态" color={colors.gold} /><Pressable onPress={onStatus}><Text style={styles.textButton}>更新 ↗</Text></Pressable></View><View style={styles.orbit}><View style={styles.orbitRingOne} /><View style={styles.orbitRingTwo} /><View style={styles.orbitCenter}><Text style={styles.orbitScore}>3.4</Text><Text style={styles.orbitLabel}>清晰度</Text></View></View>
        {[['压力', '中', colors.terracotta, 62], ['精力', '中上', colors.sage, 74], ['掌控感', '中', colors.lilac, 49]].map(([label, value, color, width]) => <View key={String(label)} style={styles.metricRow}><View style={styles.metricTrack}><View style={[styles.metricValue, { backgroundColor: String(color), width: `${Number(width)}%` }]} /></View><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValueText}>{value}</Text></View>)}
        <View style={styles.stateFooter}><Text>最近 7 天</Text><Text style={styles.trend}>清晰度 ↑ 0.6</Text></View>
      </View>
    </View>
    <View style={styles.sectionHeading}><View><Kicker label="今天的一步" color={colors.terracotta} /><Text style={styles.sectionTitle}>一个可完成的行动</Text></View><Text style={styles.estimate}>预计 15 分钟</Text></View>
    <View style={styles.card}><View style={styles.actionRow}><Text style={styles.actionNumber}>01</Text><View style={styles.actionCopy}><Text style={styles.actionType}>收集信息</Text><Text style={styles.actionTitle}>把等待中的消息，分成「已发生」和「我在猜」。</Text><Text style={styles.bodyText}>打开备忘录，写下你现在最挂念的三件事，并给每一件标记：已发生 / 有证据 / 纯猜测。</Text></View></View><PrimaryButton label={done ? '今天已完成' : '完成这一步'} done={done} onPress={() => setDone(!done)} /><EvidenceRow kind="action" /></View>
    <View style={styles.twoCardRow}><Pressable onPress={onClarity} style={[styles.card, styles.clarityCard]}><Kicker label="随时可用" color={colors.blue} /><View style={styles.quickRow}><View><Text style={styles.quickTitle}>我现在有点乱</Text><Text style={styles.quickText}>把事实、解释和担心分开。</Text></View><ArrowButton onPress={onClarity} /></View></Pressable><View style={[styles.card, styles.chapterCard]}><Kicker label="当前人生章节" color={colors.lilac} /><Text style={styles.chapterStatus}>探索中 · 已持续 18 天</Text><Text style={styles.chapterTitle}>在可修复的地方，重建工作节奏</Text><Text style={styles.chapterText}>下一个节点：确认三个外部岗位的真实要求</Text></View></View>
    <View style={styles.mirrorStrip}><Kicker label="七日镜像" color="#BC8C91" /><Text style={styles.mirrorTitle}>你已经比三天前更清楚了。</Text><Text style={styles.bodyText}>这周你 4 次选择了先收集事实，其中 3 次减少了反复搜索。</Text><View style={styles.chart}>{[34, 44, 38, 59, 54, 72, 80].map((height, i) => <View key={i} style={[styles.chartBar, i === 6 && styles.chartBarCurrent, { height: `${height}%` }]} />)}</View></View>
  </View>;
}

function JourneyScreen({ onClarity }: { onClarity: () => void }) {
  return <View>
    <View style={styles.heading}><Text style={styles.eyebrow}>JOURNEY · 一个人生章节</Text><Text style={styles.pageTitle}>把一件事，走得更清楚。</Text><Text style={styles.pageSubtitle}>不替你决定，只陪你把事实和选择放在一起。</Text></View>
    <View style={[styles.card, styles.journeyHero]}><View style={{ flex: 1 }}><Text style={styles.chapterStatus}>进行中 · 第 18 天</Text><Text style={styles.journeyTitle}>在可修复的地方，重建工作节奏</Text><Text style={styles.bodyText}>你正在探索：要不要换工作，以及什么条件会让这个选择变得更真实。</Text></View><View style={styles.progressCircle}><Text style={styles.progressNumber}>42%</Text><Text style={styles.progressLabel}>章节进度</Text></View></View>
    <View style={styles.sectionHeading}><View><Kicker label="当前状态" color={colors.gold} /><Text style={styles.sectionTitle}>不是没有答案，是信息还在路上。</Text></View></View>
    <View style={styles.card}><TimelineItem state="done" label="已完成 · 8 月 2 日" title="整理现金储备与可承受周期" text="已确认至少可以维持 5 个月的基础支出。" /><TimelineItem state="active" label="正在进行 · 今天" title="确认三个外部岗位的真实要求" text="不要先判断自己行不行，先把岗位事实收集完整。" action="记录进展" /><TimelineItem state="upcoming" label="待验证 · 本周" title="和一位可信任的人讨论选择条件" text="" /></View>
    <View style={[styles.card, styles.conditionsCard]}><Kicker label="关键待验证" color={colors.lilac} />{['外部岗位数量是否足够', '当前工作是否仍可修复', '身体和精力是否允许转换'].map((item, i) => <View key={item} style={styles.conditionRow}><Text style={styles.conditionNumber}>0{i + 1}</Text><Text style={styles.conditionText}>{item}</Text></View>)}<EvidenceRow kind="action" /></View>
    <View style={styles.bottomNotice}><Kicker label="章节提醒" color={colors.blue} /><Text style={styles.noticeText}>先别把“想离开”直接翻译成“必须辞职”。你现在要验证的是：有没有更适合的结构。</Text><Pressable onPress={onClarity} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>写一条今天的记录 →</Text></Pressable></View>
  </View>;
}

function TimelineItem({ state, label, title, text, action }: { state: 'done' | 'active' | 'upcoming'; label: string; title: string; text: string; action?: string }) {
  return <View style={styles.timelineItem}><View style={[styles.timelineDot, state === 'active' && styles.timelineDotActive]} /><View style={styles.timelineContent}><Text style={styles.timelineLabel}>{label}</Text><Text style={styles.timelineTitle}>{title}</Text>{text ? <Text style={styles.timelineText}>{text}</Text> : null}{action ? <Pressable style={styles.smallButton}><Text style={styles.smallButtonText}>{action} →</Text></Pressable> : null}</View></View>;
}

function YearScreen() {
  return <View>
    <View style={styles.heading}><Text style={styles.eyebrow}>YEAR · 一年导航</Text><Text style={styles.pageTitle}>重建结构，再选择扩张。</Text><Text style={styles.pageSubtitle}>这是一个预测 + 验证的年度视角，会随现实事件更新。</Text></View>
    <View style={[styles.card, styles.yearHero]}><Kicker label="年度总览 · 2026" color={colors.terracotta} /><Text style={styles.yearTitle}>不必迅速证明自己，先把可持续的结构搭起来。</Text><Text style={styles.bodyText}>上半年更适合整理资源与验证方向，下半年把成熟选择转为行动。</Text><View style={styles.tagRow}>{['整理', '验证', '渐进扩张'].map(tag => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View><View style={styles.yearCore}><Text style={styles.yearCoreNumber}>2026</Text><Text style={styles.yearCoreLabel}>年度导航</Text></View></View>
    <View style={styles.sectionHeading}><View><Kicker label="四季度节奏" color={colors.gold} /><Text style={styles.sectionTitle}>现在先看 Q3 的转折感</Text></View><Text style={styles.textButton}>版本变化 ↗</Text></View>
    <View style={styles.quarterGrid}>{[['Q1', '整理', '把资源重新归位。'], ['Q2', '试探', '小范围验证方向。'], ['Q3', '转折', '把成熟选择变成行动。'], ['Q4', '收尾', '复盘真正有效的变化。']].map(([quarter, title, summary], i) => <View key={quarter} style={[styles.quarterCard, i === 2 && styles.quarterActive]}><Text style={styles.timelineLabel}>{quarter} · {i < 2 ? '已完成' : i === 2 ? '进行中' : '待进入'}</Text><Text style={styles.quarterTitle}>{title}</Text><Text style={styles.quarterText}>{summary}</Text><View style={[styles.quarterLine, i < 2 && styles.quarterLineDone, i === 2 && styles.quarterLineActive]} /></View>)}</View>
    <View style={styles.domainGrid}>{[['↗', '事业', '先验证，再换轨'], ['⌁', '财务', '守住现金流边界'], ['♡', '关系', '让边界说得更早'], ['○', '健康', '恢复是基础设施'], ['✦', '自我', '从证明转向选择']].map(([icon, label, title]) => <View key={label} style={styles.domainCard}><Text style={styles.domainIcon}>{icon}</Text><Text style={styles.domainLabel}>{label}</Text><Text style={styles.domainTitle}>{title}</Text></View>)}</View>
    <View style={[styles.card, styles.monthCard]}><Kicker label="月度导航" color="#BC8C91" /><Text style={styles.sectionTitle}>接下来三个月</Text><View style={styles.monthRow}>{[['08', '收集'], ['09', '试行'], ['10', '确认']].map(([month, title], i) => <View key={month} style={[styles.monthItem, i === 1 && styles.monthItemActive]}><Text style={styles.monthNumber}>{month}</Text><Text style={styles.monthTitle}>{title}</Text><Text style={styles.monthText}>{i === 0 ? '把事实收齐' : i === 1 ? '做一次可逆尝试' : '看行动后的反馈'}</Text></View>)}</View><EvidenceRow kind="year" /></View>
  </View>;
}

function ClaritySheet({ step, setStep, onClose }: { step: number; setStep: (step: number) => void; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [emotion, setEmotion] = useState('');
  const emotions = ['害怕', '愤怒', '无力', '羞耻', '后悔', '失望', '麻木', '其他'];
  return <Sheet title="我现在有点乱" onClose={onClose}>
    <View style={styles.sheetProgress}>{[1, 2, 3].map(i => <View key={i} style={[styles.sheetProgressBar, i <= step && styles.sheetProgressActive]} />)}</View>
    {step === 1 && <><Text style={styles.sheetEyebrow}>01 · 发生了什么？</Text><Text style={styles.sheetTitle}>把刚刚发生的事写下来。</Text><Text style={styles.sheetSubtitle}>不用组织得很完整，先留下一件真实发生的事。</Text><TextInput value={input} onChangeText={setInput} multiline placeholder="例如：今天早上收到一条模糊的工作消息……" placeholderTextColor="#A9ADA4" style={styles.textArea} /><PrimaryButton label="继续" onPress={() => setStep(2)} /></>}
    {step === 2 && <><Text style={styles.sheetEyebrow}>02 · 现在最强烈的感受是？</Text><Text style={styles.sheetTitle}>先命名它，不需要解释它。</Text><Text style={styles.sheetSubtitle}>情绪是信号，不是最后的结论。</Text><View style={styles.emotionGrid}>{emotions.map(item => <Pressable key={item} onPress={() => setEmotion(item)} style={[styles.emotionButton, emotion === item && styles.emotionSelected]}><Text>{item}</Text></Pressable>)}</View><PrimaryButton label="继续" onPress={() => setStep(3)} /></>}
    {step === 3 && <><Text style={styles.sheetEyebrow}>03 · 先把三层分开。</Text><Text style={styles.sheetTitle}>你不需要同时背着三种东西。</Text>{[['已经发生的事实', '对方发来了一条消息，但没有说明截止时间。'], ['你对事实的解释', '我是不是又做得不够好，所以对方不愿明说？'], ['你担心未来会发生什么', '这可能会影响我接下来的工作安排。']].map(([label, text]) => <View key={label} style={styles.triadItem}><Text style={styles.triadLabel}>{label}</Text><Text style={styles.triadText}>{text}</Text></View>)}<View style={styles.recommendation}><Text style={styles.triadLabel}>下一小时建议</Text><Text style={styles.recommendationTitle}>先不要立即回复，离开聊天界面 20 分钟。</Text><Text style={styles.triadText}>把真正需要确认的问题写成一句话，之后再决定是否发送。</Text></View><EvidenceRow kind="action" /><PrimaryButton label="先去做这一步" onPress={onClose} /></>}
  </Sheet>;
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetHeaderTitle}>{title}</Text><Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">{children}</ScrollView></View>;
}

function StatusSheet({ onClose }: { onClose: () => void }) {
  const [clarity, setClarity] = useState(3);
  return <Sheet title="现在的状态" onClose={onClose}><Text style={styles.sheetEyebrow}>今日状态</Text><Text style={styles.sheetTitle}>只记录当下，不把它变成结论。</Text>{([['清晰度', clarity, setClarity], ['精力', 4, () => undefined], ['压力', 3, () => undefined]] as Array<[string, number, (value: number) => void]>).map(([label, value, setValue]) => <View key={String(label)} style={styles.choiceRow}><View style={styles.choiceHeader}><Text style={styles.choiceLabel}>{label}</Text><Text style={styles.choiceValue}>{String(value)}</Text></View><View style={styles.choiceButtons}>{[1, 2, 3, 4, 5].map(item => <Pressable key={item} onPress={() => (setValue as (n: number) => void)(item)} style={[styles.choiceButton, item === value && styles.choiceButtonActive]}><Text>{item}</Text></Pressable>)}</View></View>)}<PrimaryButton label="保存今天的状态" onPress={onClose} /></Sheet>;
}

function SafetySheet({ onClose }: { onClose: () => void }) {
  return <Sheet title="安全边界" onClose={onClose}><View style={styles.safetyIcon}><Text>♡</Text></View><Text style={styles.sheetTitle}>现实优先，命理只是文化视角。</Text><Text style={styles.sheetSubtitle}>知时不会替代医疗、法律、财务或心理服务，也不会用“注定”“必然”制造恐惧。涉及高风险内容时，系统会优先建议你联系专业人士或可信任的人。</Text>{['不预测灾祸、生死和疾病', '不替你做重大人生决定', '所有判断都显示信息来源与限制'].map(item => <Text key={item} style={styles.safetyItem}>✓  {item}</Text>)}<PrimaryButton label="我知道了" onPress={onClose} /></Sheet>;
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  return <Sheet title="我的底图" onClose={onClose}><Text style={styles.sheetEyebrow}>个人资料</Text><Text style={styles.sheetTitle}>让表达更像是对你说的。</Text><Text style={styles.sheetSubtitle}>你的资料只用于生成个性化内容，不用于命定结论。</Text><Text style={styles.choiceLabel}>你现在最关注什么？</Text><View style={styles.emotionGrid}>{['工作', '钱', '关系', '自我方向', '家庭', '搬迁 / 留学'].map(item => <Pressable key={item} style={styles.emotionButton}><Text>{item}</Text></Pressable>)}</View><PrimaryButton label="保存设置" onPress={onClose} /></Sheet>;
}

function TabBar({ view, setView, onClarity }: { view: ViewKey; setView: (view: ViewKey) => void; onClarity: () => void }) {
  return <View style={styles.tabBar}><TabItem active={view === 'daily'} label="今天" icon="◌" onPress={() => setView('daily')} /><TabItem active={view === 'journey'} label="章节" icon="↗" onPress={() => setView('journey')} /><Pressable onPress={onClarity} style={styles.centerTab}><Text style={styles.centerTabIcon}>✦</Text><Text style={styles.centerTabLabel}>有点乱</Text></Pressable><TabItem active={view === 'year'} label="一年" icon="⌁" onPress={() => setView('year')} /><TabItem active={false} label="我的" icon="林" onPress={onClarity} /></View>;
}

function TabItem({ active, label, icon, onPress }: { active: boolean; label: string; icon: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.tabItem}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>;
}

export default function App() {
  const [view, setView] = useState<ViewKey>('daily');
  const [modal, setModal] = useState<ModalKey>(null);
  const [clarityStep, setClarityStep] = useState(1);
  const [apiOnline, setApiOnline] = useState(false);
  const openClarity = () => { setClarityStep(1); setModal('clarity'); };
  useEffect(() => {
    getApiHealth().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
  }, []);
  return <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={colors.paper} /><View style={styles.app}><Header onSafety={() => setModal('safety')} onProfile={() => setModal('profile')} apiOnline={apiOnline} /><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>{view === 'daily' ? <DailyScreen onClarity={openClarity} onStatus={() => setModal('status')} /> : view === 'journey' ? <JourneyScreen onClarity={openClarity} /> : <YearScreen />}</ScrollView><TabBar view={view} setView={setView} onClarity={openClarity} />
    <Modal visible={modal === 'clarity'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}><ClaritySheet step={clarityStep} setStep={setClarityStep} onClose={() => setModal(null)} /></View></Modal>
    <Modal visible={modal === 'status'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}><StatusSheet onClose={() => setModal(null)} /></View></Modal>
    <Modal visible={modal === 'safety'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}><SafetySheet onClose={() => setModal(null)} /></View></Modal>
    <Modal visible={modal === 'profile'} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.modalBackdrop}><ProfileSheet onClose={() => setModal(null)} /></View></Modal>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper }, app: { flex: 1, backgroundColor: colors.paper }, scrollContent: { padding: 20, paddingBottom: 30 }, header: { height: 66, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brandLine: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: colors.paper, fontSize: 18, fontWeight: '700' }, brandName: { color: colors.ink, fontSize: 17, fontWeight: '700' }, brandSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headerIcon: { padding: 8 }, profileChip: { flexDirection: 'row', alignItems: 'center', gap: 6 }, avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#D2D9C7', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.sageDeep, fontSize: 12 }, profileName: { color: colors.ink, fontSize: 11 }, chevron: { color: colors.muted, fontSize: 15 }, heading: { paddingTop: 18, marginBottom: 24 }, eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.2 }, pageTitle: { color: colors.ink, fontSize: 30, fontWeight: '600', marginTop: 11, letterSpacing: -1 }, pageSubtitle: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 19 }, rowCards: { gap: 14 }, card: { borderWidth: 1, borderColor: colors.line, borderRadius: 21, backgroundColor: colors.card, padding: 19, shadowColor: '#514F43', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 }, focusCard: { backgroundColor: '#FFFDF8' }, stateCard: { backgroundColor: '#F2F2EA' }, kicker: { flexDirection: 'row', alignItems: 'center', gap: 7 }, kickerDot: { width: 6, height: 6, borderRadius: 3 }, kickerText: { color: '#858981', fontSize: 9, letterSpacing: 0.9, textTransform: 'uppercase' }, focusTitle: { color: colors.ink, fontSize: 22, fontWeight: '600', lineHeight: 31, marginTop: 27, letterSpacing: -0.6 }, bodyText: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 11 }, noteBox: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 28, paddingTop: 14 }, noteLabel: { color: colors.terracotta, fontSize: 9, marginBottom: 6 }, noteText: { color: colors.ink, fontSize: 13, lineHeight: 21, fontWeight: '500' }, evidenceWrap: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 17, paddingTop: 11 }, evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 }, evidenceGlyph: { color: colors.sageDeep, fontSize: 14 }, evidenceLabel: { flex: 1, color: '#888C83', fontSize: 10 }, evidenceChevron: { color: '#AAA9A1', fontSize: 15 }, evidenceBody: { marginTop: 12, gap: 7 }, evidenceSource: { backgroundColor: '#F0EFE8', borderRadius: 10, padding: 10 }, evidenceSourceTitle: { color: '#6C7269', fontSize: 9, fontWeight: '600' }, evidenceSourceText: { color: '#999B93', fontSize: 9, lineHeight: 15, marginTop: 4 }, evidenceSummary: { color: '#747971', fontSize: 11, lineHeight: 18, marginTop: 3 }, evidenceMeta: { flexDirection: 'row', justifyContent: 'space-between' }, evidenceMetaText: { color: '#9A9D94', fontSize: 8 }, cardTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, textButton: { color: '#7F857C', fontSize: 10 }, orbit: { height: 170, alignItems: 'center', justifyContent: 'center', position: 'relative' }, orbitRingOne: { position: 'absolute', width: 184, height: 108, borderRadius: 92, borderWidth: 1, borderColor: 'rgba(137,155,125,0.25)', transform: [{ rotate: '-24deg' }] }, orbitRingTwo: { position: 'absolute', width: 220, height: 144, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(196,161,95,0.22)', transform: [{ rotate: '28deg' }] }, orbitCenter: { width: 75, height: 75, borderRadius: 38, backgroundColor: '#FFFEFA', alignItems: 'center', justifyContent: 'center', elevation: 2 }, orbitScore: { color: colors.ink, fontSize: 24, fontWeight: '600' }, orbitLabel: { color: colors.muted, fontSize: 9, marginTop: 3 }, metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }, metricTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DFE0D5', overflow: 'hidden' }, metricValue: { height: 4, borderRadius: 2 }, metricLabel: { width: 35, color: '#6F746C', fontSize: 9 }, metricValueText: { width: 28, color: '#A0A29A', fontSize: 9, textAlign: 'right' }, stateFooter: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 16, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }, trend: { color: colors.sageDeep }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 34, marginBottom: 14 }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginTop: 8, letterSpacing: -0.4 }, estimate: { color: '#A1A39B', fontSize: 9 }, actionRow: { flexDirection: 'row', gap: 14 }, actionNumber: { color: '#C2C5BD', fontSize: 13, paddingTop: 3 }, actionCopy: { flex: 1 }, actionType: { color: colors.terracotta, fontSize: 9 }, actionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 7 }, primaryButton: { marginTop: 18, borderRadius: 11, backgroundColor: colors.ink, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, primaryButtonDone: { backgroundColor: colors.sageDeep }, primaryButtonLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' }, primaryButtonArrow: { color: '#FFF', fontSize: 15 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }, twoCardRow: { gap: 14, marginTop: 27 }, clarityCard: { backgroundColor: '#E9EEEA' }, chapterCard: { backgroundColor: '#FFFEFA' }, quickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 42 }, quickTitle: { color: colors.ink, fontSize: 19, fontWeight: '600' }, quickText: { color: '#778078', fontSize: 10, marginTop: 6 }, arrowButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(88,109,84,0.22)', alignItems: 'center', justifyContent: 'center' }, arrowButtonText: { color: colors.sageDeep, fontSize: 17 }, chapterStatus: { color: colors.lilac, fontSize: 9, marginTop: 17 }, chapterTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 21, marginTop: 7 }, chapterText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 }, mirrorStrip: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 22, marginTop: 28 }, mirrorTitle: { color: colors.ink, fontSize: 17, fontWeight: '600', marginTop: 9 }, chart: { height: 44, flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 17, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 8 }, chartBar: { width: 8, minHeight: 5, backgroundColor: '#C7D2C2', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartBarCurrent: { backgroundColor: colors.sageDeep }, journeyHero: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#F2F5ED' }, journeyTitle: { color: colors.ink, fontSize: 22, fontWeight: '600', lineHeight: 30, marginTop: 14, marginBottom: 2 }, progressCircle: { width: 94, height: 94, borderRadius: 47, borderWidth: 1, borderColor: 'rgba(88,109,84,0.28)', alignItems: 'center', justifyContent: 'center' }, progressNumber: { color: colors.ink, fontSize: 20, fontWeight: '600' }, progressLabel: { color: colors.muted, fontSize: 8, marginTop: 4 }, timelineItem: { flexDirection: 'row', gap: 13, paddingBottom: 25 }, timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#C4C8BF', marginTop: 5 }, timelineDotActive: { backgroundColor: colors.terracotta }, timelineContent: { flex: 1 }, timelineLabel: { color: '#999D94', fontSize: 8 }, timelineTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 7 }, timelineText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 }, smallButton: { alignSelf: 'flex-start', backgroundColor: '#EFF2EB', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11, marginTop: 12 }, smallButtonText: { color: colors.sageDeep, fontSize: 10 }, conditionsCard: { marginTop: 2 }, conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, conditionNumber: { color: '#B8C1B3', fontSize: 9 }, conditionText: { color: colors.ink, fontSize: 13 }, bottomNotice: { backgroundColor: '#EEEFE7', borderRadius: 15, padding: 17, marginTop: 26 }, noticeText: { color: '#777D74', fontSize: 12, lineHeight: 19, marginTop: 7 }, secondaryButton: { backgroundColor: colors.ink, borderRadius: 10, padding: 12, marginTop: 14, alignItems: 'center' }, secondaryButtonText: { color: '#FFF', fontSize: 10 }, yearHero: { backgroundColor: '#FAF2E8', paddingBottom: 20 }, yearTitle: { color: colors.ink, fontSize: 23, fontWeight: '600', lineHeight: 31, marginTop: 17 }, tagRow: { flexDirection: 'row', gap: 7, marginTop: 17 }, tag: { color: '#827663', backgroundColor: '#FFFDF8', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, fontSize: 8 }, yearCore: { alignSelf: 'center', width: 94, height: 94, borderRadius: 47, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', marginTop: 20 }, yearCoreNumber: { color: colors.ink, fontSize: 20, fontWeight: '600' }, yearCoreLabel: { color: colors.muted, fontSize: 8, marginTop: 4 }, quarterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, quarterCard: { width: '48%', minHeight: 145, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 14, backgroundColor: 'rgba(255,255,252,0.5)' }, quarterActive: { borderColor: 'rgba(199,122,89,0.35)', backgroundColor: '#FAF2E8' }, quarterTitle: { color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 14 }, quarterText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 }, quarterLine: { height: 3, borderRadius: 3, backgroundColor: '#E1E2DA', marginTop: 18 }, quarterLineDone: { backgroundColor: colors.sage }, quarterLineActive: { backgroundColor: colors.terracotta }, domainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 26 }, domainCard: { width: '31.7%', minHeight: 115, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: colors.card }, domainIcon: { color: colors.sageDeep, fontSize: 18 }, domainLabel: { color: '#969A91', fontSize: 8, marginTop: 8 }, domainTitle: { color: colors.ink, fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 5 }, monthCard: { marginTop: 27 }, monthRow: { gap: 9, marginTop: 18 }, monthItem: { backgroundColor: '#F2F1E9', borderRadius: 12, padding: 13, minHeight: 55 }, monthItemActive: { backgroundColor: '#E8EEE4', borderWidth: 1, borderColor: '#D4DFCF' }, monthNumber: { color: '#B2B8AC', fontSize: 13 }, monthTitle: { color: colors.ink, fontSize: 13, fontWeight: '600', position: 'absolute', left: 48, top: 12 }, monthText: { color: colors.muted, fontSize: 9, position: 'absolute', left: 48, top: 32 }, tabBar: { height: 68, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: 'rgba(249,248,243,0.97)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 }, tabItem: { flex: 1, alignItems: 'center', gap: 3 }, tabIcon: { color: '#9B9F96', fontSize: 18 }, tabLabel: { color: '#9B9F96', fontSize: 9 }, tabActive: { color: colors.ink }, centerTab: { flex: 1, alignItems: 'center', marginTop: -24 }, centerTabIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, color: '#FFF', textAlign: 'center', lineHeight: 35, fontSize: 16, borderWidth: 4, borderColor: colors.paper, overflow: 'hidden' }, centerTabLabel: { color: colors.sageDeep, fontSize: 9, marginTop: 2 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(39,43,39,0.35)', justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor: '#F9F8F3', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 19, paddingHorizontal: 20, paddingBottom: 25 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }, sheetHeaderTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' }, closeText: { color: '#989C92', fontSize: 25, lineHeight: 25 }, sheetContent: { paddingBottom: 12 }, sheetProgress: { flexDirection: 'row', gap: 5, marginBottom: 27 }, sheetProgressBar: { height: 3, flex: 1, borderRadius: 2, backgroundColor: '#E3E4DC' }, sheetProgressActive: { backgroundColor: colors.sageDeep }, sheetEyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.1, marginTop: 4 }, sheetTitle: { color: colors.ink, fontSize: 25, fontWeight: '600', lineHeight: 33, marginTop: 12, letterSpacing: -0.5 }, sheetSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 9, marginBottom: 17 }, textArea: { minHeight: 125, borderWidth: 1, borderColor: 'rgba(43,48,43,0.2)', borderRadius: 13, padding: 14, color: colors.ink, fontSize: 12, textAlignVertical: 'top', backgroundColor: '#FFFDF8' }, emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, emotionButton: { width: '23%', paddingVertical: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: 'center', backgroundColor: '#FFFDF8' }, emotionSelected: { backgroundColor: '#E8EEE4', borderColor: '#CCDAC6' }, triadItem: { backgroundColor: '#F0F0E9', borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#CBD4C5' }, triadLabel: { color: '#8C9188', fontSize: 8, letterSpacing: 0.3 }, triadText: { color: '#686E66', fontSize: 11, lineHeight: 17, marginTop: 5 }, recommendation: { backgroundColor: '#E7EEE4', borderRadius: 12, padding: 14, marginTop: 14 }, recommendationTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 21, marginTop: 7 }, choiceRow: { marginTop: 21 }, choiceHeader: { flexDirection: 'row', justifyContent: 'space-between' }, choiceLabel: { color: '#737970', fontSize: 12 }, choiceValue: { color: colors.sageDeep, fontSize: 12 }, choiceButtons: { flexDirection: 'row', gap: 8, marginTop: 10 }, choiceButton: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }, choiceButtonActive: { backgroundColor: '#E8EEE4', borderColor: '#CCDAC6' }, safetyIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#E8EEE4', alignItems: 'center', justifyContent: 'center', marginTop: 6 }, safetyItem: { color: '#6E766B', fontSize: 11, marginTop: 13 },
});
