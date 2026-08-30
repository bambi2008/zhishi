import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  BaziCalculationInput,
  GuidanceConversationMessage,
  GuidanceScope,
  GuidanceTurnResult,
  ZhishiApiError,
  generateGuidanceTurn,
} from './api';
import { loadStoredBaziChart } from './chartStorage';
import { DailyStateRecord } from './dailyStateStorage';

const palette = {
  paper: '#F7F5EF',
  card: '#FFFEFA',
  ink: '#252927',
  muted: '#737970',
  line: 'rgba(43,48,43,0.12)',
  sage: '#899B7D',
  sageDeep: '#586D54',
  terracotta: '#C77A59',
  blue: '#70909E',
};

type GuidanceExchange = {
  user: string;
  result: GuidanceTurnResult;
};

type GuidanceSheetProps = {
  scope: GuidanceScope;
  initialPrompt?: string;
  todayState: DailyStateRecord | null;
  chartRevision: number;
  onClose: () => void;
  onOpenBazi: () => void;
};

const todayPrompts = [
  '今天先做什么？',
  '事业怎么落地？',
  '人际要注意什么？',
  '投资先检查什么？',
  '我现在有点乱',
];

const yearPrompts = [
  '未来 90 天先抓什么？',
  '事业如何设检查点？',
  '关系上怎样少走弯路？',
  '重大决定先核对什么？',
];

function assistantTranscript(result: GuidanceTurnResult): string {
  return JSON.stringify({
    headline: result.headline,
    direct_answer: result.direct_answer,
    next_step: result.next_step,
    follow_up_question: result.follow_up_question,
  });
}

function buildConversation(exchanges: GuidanceExchange[], latestUserText: string): GuidanceConversationMessage[] {
  const messages: GuidanceConversationMessage[] = [];
  exchanges.forEach(exchange => {
    messages.push({ role: 'user', content: exchange.user });
    messages.push({ role: 'assistant', content: assistantTranscript(exchange.result) });
  });
  messages.push({ role: 'user', content: latestUserText });
  return messages;
}

function GuidanceResultCard({ result }: { result: GuidanceTurnResult }) {
  const cited = result.evidence_catalog.filter(item => result.evidence_ids.includes(item.id));
  return <View accessibilityLiveRegion="polite" style={styles.answerCard}>
    <View style={styles.answerMetaRow}>
      <View style={styles.answerMetaLead}>
        <SymbolView
          name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
          size={17}
          tintColor={palette.sageDeep}
        />
        <Text style={styles.answerMeta}>知时建议 · AI 生成</Text>
      </View>
      <Text style={styles.answerContext}>{result.context_mode === 'audited_chart_and_reality' ? '命盘 + 现实' : '仅现实信息'}</Text>
    </View>
    <Text style={styles.answerHeadline}>{result.headline}</Text>
    <Text style={styles.answerBody}>{result.direct_answer}</Text>

    <View style={styles.nextStepCard}>
      <Text style={styles.blockEyebrow}>先做这一件事</Text>
      <Text style={styles.nextStepAction}>{result.next_step.action}</Text>
      <View style={styles.nextStepGrid}>
        <View style={styles.nextStepMetaBlock}><Text style={styles.nextStepMetaLabel}>什么时候</Text><Text style={styles.nextStepMetaValue}>{result.next_step.when}</Text></View>
        <View style={styles.nextStepMetaBlock}><Text style={styles.nextStepMetaLabel}>做到什么算完成</Text><Text style={styles.nextStepMetaValue}>{result.next_step.done_when}</Text></View>
      </View>
    </View>

    <Text style={styles.sectionTitle}>具体可以这样做</Text>
    {result.examples.map((example, index) => <View key={`${example.title}-${index}`} style={styles.exampleCard}>
      <View style={styles.exampleHeader}><Text style={styles.exampleIndex}>0{index + 1}</Text><Text style={styles.exampleTitle}>{example.title}</Text></View>
      <Text style={styles.exampleSituation}>适用情况 · {example.situation}</Text>
      <Text style={styles.exampleTry}>{example.try_this}</Text>
      <View style={styles.exampleWatch}><Text style={styles.exampleWatchLabel}>留意</Text><Text style={styles.exampleWatchText}>{example.watch_for}</Text></View>
    </View>)}

    <View style={styles.watchoutCard}>
      <Text style={styles.watchoutTitle}>边界与风险</Text>
      {result.watchouts.map((item, index) => <Text key={`${item}-${index}`} style={styles.watchoutText}>• {item}</Text>)}
      <Text style={styles.watchoutText}>• {result.uncertainty_notice}</Text>
    </View>

    <View style={styles.evidenceBlock}>
      <Text style={styles.evidenceTitle}>这轮用了什么依据</Text>
      {cited.map(item => <View key={item.id} style={styles.evidenceRow}>
        <Text style={styles.evidenceSource}>{item.source === 'calculation' ? '计算' : '现实'}</Text>
        <View style={styles.evidenceCopy}><Text style={styles.evidenceLabel}>{item.label}</Text><Text style={styles.evidenceValue} numberOfLines={3}>{item.value}</Text></View>
      </View>)}
    </View>

    <View style={styles.followUpCard}>
      <Text style={styles.followUpLabel}>只追问一个会改变建议的问题</Text>
      <Text style={styles.followUpQuestion}>{result.follow_up_question}</Text>
    </View>
  </View>;
}

export function GuidanceSheet({ scope, initialPrompt = '', todayState, chartRevision, onClose, onOpenBazi }: GuidanceSheetProps) {
  const [input, setInput] = useState(initialPrompt);
  const [chart, setChart] = useState<BaziCalculationInput | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [exchanges, setExchanges] = useState<GuidanceExchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const prompts = scope === 'today' ? todayPrompts : yearPrompts;
  const reachedLimit = exchanges.length >= 5;

  useEffect(() => {
    let active = true;
    setChartLoading(true);
    loadStoredBaziChart()
      .then(stored => {
        if (active) setChart(stored?.input ?? null);
      })
      .catch(() => {
        if (active) setChart(null);
      })
      .finally(() => {
        if (active) setChartLoading(false);
      });
    return () => { active = false; };
  }, [chartRevision]);

  const send = async () => {
    const latest = input.trim();
    if (!latest || loading || reachedLimit || chartLoading) return;
    if (scope === 'year' && !chart) {
      setError('“今年”需要先有一张已保存且审计通过的命盘。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await generateGuidanceTurn({
        scope,
        chart,
        dailyState: todayState ? {
          localDate: todayState.localDate,
          energy: todayState.energy,
          stress: todayState.stress,
          emotion: todayState.emotion,
          focusArea: todayState.focusArea,
          importantEvent: todayState.importantEvent,
          note: todayState.note,
        } : null,
        conversation: buildConversation(exchanges, latest),
      });
      setExchanges(previous => [...previous, { user: latest, result }]);
      setInput('');
    } catch (requestError) {
      if (requestError instanceof ZhishiApiError && requestError.code === 'interpretation_provider_not_configured') {
        setError('DeepSeek 对话服务尚未配置完成。你的文字仍留在输入框里。');
      } else {
        setError(requestError instanceof Error ? requestError.message : '知时暂时没有接上这轮对话，请重试。');
      }
    } finally {
      setLoading(false);
    }
  };

  const disclosureParts = ['你本轮发送的文字'];
  if (todayState) disclosureParts.push('今天主动记录的状态');
  if (chart) disclosureParts.push('最少量已审计命盘与周期事实');

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.shell}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.headerEyebrow}>{scope === 'today' ? '今天 · 24–72 小时' : '今年 · 30–90 天检查点'}</Text>
        <Text style={styles.headerTitle}>和知时聊清楚</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭对话" onPress={onClose} style={styles.closeButton}>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={palette.ink} />
      </Pressable>
    </View>

    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {!exchanges.length ? <View style={styles.introCard}>
        <View style={styles.introIcon}>
          <SymbolView name={{ ios: 'bubble.left.and.text.bubble.right.fill', android: 'forum', web: 'forum' }} size={24} tintColor={palette.sageDeep} />
        </View>
        <Text style={styles.introTitle}>先给答案，再和你核对。</Text>
        <Text style={styles.introText}>{scope === 'today' ? '不需要先填三页表单。说出现在最想解决的一件事，我会先给具体做法和例子，再只问一个关键问题。' : '把年度文化线索翻译成未来 30–90 天的行动、检查点和停止条件，不预测某件事一定发生。'}</Text>
        <View style={styles.promiseRow}><Text style={styles.promiseDot}>1</Text><Text style={styles.promiseText}>一个明确的下一步和完成标准</Text></View>
        <View style={styles.promiseRow}><Text style={styles.promiseDot}>2</Text><Text style={styles.promiseText}>事业、关系或投资决策的具体例子</Text></View>
        <View style={styles.promiseRow}><Text style={styles.promiseDot}>3</Text><Text style={styles.promiseText}>你补充后，整份建议会重新整理</Text></View>
      </View> : null}

      {!exchanges.length ? <View style={styles.promptSection}>
        <Text style={styles.promptTitle}>你可以从这里开始</Text>
        <View style={styles.promptWrap}>{prompts.map(prompt => <Pressable key={prompt} accessibilityRole="button" onPress={() => setInput(prompt)} style={({ pressed }) => [styles.promptChip, pressed && styles.pressed]}><Text style={styles.promptChipText}>{prompt}</Text></Pressable>)}</View>
      </View> : null}

      {scope === 'year' && !chartLoading && !chart ? <View style={styles.chartRequiredCard}>
        <Text style={styles.chartRequiredTitle}>先建立命盘，才谈“今年”。</Text>
        <Text style={styles.chartRequiredText}>年度对话不能脱离出生时区、节气边界和审计结果凭空生成。</Text>
        <Pressable accessibilityRole="button" onPress={onOpenBazi} style={styles.chartButton}><Text style={styles.chartButtonText}>建立并保存命盘</Text></Pressable>
      </View> : null}

      {exchanges.map((exchange, index) => <View key={`${exchange.result.generated_at}-${index}`} style={styles.exchange}>
        <View style={styles.userBubble}><Text style={styles.userBubbleLabel}>你</Text><Text style={styles.userBubbleText}>{exchange.user}</Text></View>
        <GuidanceResultCard result={exchange.result} />
      </View>)}

      {loading ? <View accessibilityLiveRegion="polite" style={styles.loadingCard}>
        <ActivityIndicator color={palette.sageDeep} />
        <Text style={styles.loadingText}>{exchanges.length ? '正在结合你的补充重写整份建议…' : '正在先给你一份可执行的初步建议…'}</Text>
      </View> : null}
      {error ? <View accessibilityLiveRegion="assertive" style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
      {reachedLimit ? <View style={styles.limitCard}><Text style={styles.limitTitle}>这次先收住。</Text><Text style={styles.limitText}>已经沟通 5 轮。先执行一个小步骤，得到新事实后再开启一轮，比继续堆信息更可靠。</Text></View> : null}
    </ScrollView>

    <View style={styles.composerArea}>
      <Text style={styles.disclosure}>点击发送即同意把{disclosureParts.join('、')}交给 DeepSeek 生成回复；知时 API 不保存本次对话。不要填写姓名、联系方式、密码或完整金融账户信息。</Text>
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="给知时的消息"
          value={input}
          onChangeText={setInput}
          editable={!reachedLimit}
          maxLength={1200}
          multiline
          textContentType="none"
          autoCorrect
          spellCheck
          placeholder={exchanges.length ? exchanges[exchanges.length - 1].result.follow_up_question : '说出你最想解决的一件事…'}
          placeholderTextColor="#969B93"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="发送给知时"
          accessibilityState={{ disabled: !input.trim() || loading || reachedLimit || chartLoading }}
          disabled={!input.trim() || loading || reachedLimit || chartLoading}
          onPress={send}
          style={({ pressed }) => [styles.sendButton, (!input.trim() || loading || reachedLimit || chartLoading) && styles.sendDisabled, pressed && styles.pressed]}
        >
          <SymbolView
            name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
            size={20}
            weight="semibold"
            tintColor="#FFFFFF"
            animationSpec={loading ? { effect: { type: 'pulse' }, repeating: true } : undefined}
          />
        </Pressable>
      </View>
      <Text style={styles.voiceHint}>可直接打字，或使用 iPhone 键盘听写；知时本身不录音。</Text>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  shell: { height: '96%', backgroundColor: palette.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  header: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: 'rgba(255,254,250,0.98)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  headerEyebrow: { color: palette.sageDeep, fontSize: 13, fontWeight: '600' },
  headerTitle: { color: palette.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEEE8' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  introCard: { borderRadius: 22, backgroundColor: '#EAF0E7', padding: 20 },
  introIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE7D8' },
  introTitle: { color: palette.ink, fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5, marginTop: 18 },
  introText: { color: palette.muted, fontSize: 16, lineHeight: 24, marginTop: 10 },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 13 },
  promiseDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.card, color: palette.sageDeep, textAlign: 'center', lineHeight: 24, fontSize: 13, fontWeight: '700', overflow: 'hidden' },
  promiseText: { flex: 1, color: palette.ink, fontSize: 15, lineHeight: 21 },
  promptSection: { marginTop: 22 },
  promptTitle: { color: palette.ink, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  promptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  promptChip: { minHeight: 44, borderWidth: 1, borderColor: 'rgba(88,109,84,0.22)', borderRadius: 22, backgroundColor: palette.card, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  promptChipText: { color: palette.sageDeep, fontSize: 15, fontWeight: '600' },
  chartRequiredCard: { borderRadius: 18, backgroundColor: '#FAEDE6', padding: 18, marginTop: 18 },
  chartRequiredTitle: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  chartRequiredText: { color: '#7C665D', fontSize: 15, lineHeight: 22, marginTop: 8 },
  chartButton: { minHeight: 48, borderRadius: 14, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  chartButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  exchange: { marginBottom: 22 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '88%', borderRadius: 18, borderBottomRightRadius: 5, backgroundColor: palette.ink, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 12 },
  userBubbleLabel: { color: '#B9C9B4', fontSize: 12, fontWeight: '700' },
  userBubbleText: { color: '#FFF', fontSize: 16, lineHeight: 23, marginTop: 4 },
  answerCard: { borderWidth: 1, borderColor: palette.line, borderRadius: 22, backgroundColor: palette.card, padding: 18 },
  answerMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  answerMetaLead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  answerMeta: { color: palette.sageDeep, fontSize: 13, fontWeight: '700' },
  answerContext: { color: palette.muted, fontSize: 12 },
  answerHeadline: { color: palette.ink, fontSize: 23, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5, marginTop: 18 },
  answerBody: { color: palette.ink, fontSize: 16, lineHeight: 25, marginTop: 11 },
  nextStepCard: { borderRadius: 17, backgroundColor: '#E6EFE2', padding: 16, marginTop: 18 },
  blockEyebrow: { color: palette.sageDeep, fontSize: 13, fontWeight: '700' },
  nextStepAction: { color: palette.ink, fontSize: 18, lineHeight: 26, fontWeight: '700', marginTop: 8 },
  nextStepGrid: { gap: 10, marginTop: 14 },
  nextStepMetaBlock: { borderTopWidth: 1, borderTopColor: 'rgba(88,109,84,0.16)', paddingTop: 10 },
  nextStepMetaLabel: { color: palette.sageDeep, fontSize: 12, fontWeight: '700' },
  nextStepMetaValue: { color: '#4D584A', fontSize: 15, lineHeight: 22, marginTop: 4 },
  sectionTitle: { color: palette.ink, fontSize: 19, fontWeight: '700', marginTop: 24, marginBottom: 2 },
  exampleCard: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16, marginTop: 14 },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  exampleIndex: { color: palette.terracotta, fontSize: 13, fontWeight: '700' },
  exampleTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  exampleSituation: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 9 },
  exampleTry: { color: palette.ink, fontSize: 16, lineHeight: 24, marginTop: 8 },
  exampleWatch: { borderRadius: 12, backgroundColor: '#FAEEE8', padding: 12, marginTop: 10 },
  exampleWatchLabel: { color: palette.terracotta, fontSize: 12, fontWeight: '700' },
  exampleWatchText: { color: '#765E53', fontSize: 14, lineHeight: 21, marginTop: 4 },
  watchoutCard: { borderRadius: 15, backgroundColor: '#F3EEE4', padding: 14, marginTop: 20 },
  watchoutTitle: { color: '#756444', fontSize: 14, fontWeight: '700' },
  watchoutText: { color: '#716751', fontSize: 14, lineHeight: 21, marginTop: 7 },
  evidenceBlock: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 17, marginTop: 20 },
  evidenceTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  evidenceRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  evidenceSource: { alignSelf: 'flex-start', minWidth: 42, borderRadius: 10, backgroundColor: '#EDF0E8', color: palette.sageDeep, textAlign: 'center', paddingVertical: 6, paddingHorizontal: 7, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  evidenceCopy: { flex: 1 },
  evidenceLabel: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  evidenceValue: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 3 },
  followUpCard: { borderRadius: 17, backgroundColor: '#E8EEF0', padding: 16, marginTop: 20 },
  followUpLabel: { color: palette.blue, fontSize: 13, fontWeight: '700' },
  followUpQuestion: { color: palette.ink, fontSize: 18, lineHeight: 26, fontWeight: '700', marginTop: 7 },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#EAF0E7', padding: 16 },
  loadingText: { flex: 1, color: palette.sageDeep, fontSize: 15, lineHeight: 22 },
  errorCard: { borderRadius: 14, backgroundColor: '#FAE8E2', padding: 14, marginTop: 10 },
  errorText: { color: '#914B38', fontSize: 15, lineHeight: 22 },
  limitCard: { borderRadius: 15, backgroundColor: '#F3EEE4', padding: 16 },
  limitTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  limitText: { color: '#716751', fontSize: 15, lineHeight: 22, marginTop: 6 },
  composerArea: { borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.card, paddingHorizontal: 14, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 12 : 10 },
  disclosure: { color: '#7B8078', fontSize: 12, lineHeight: 17, paddingHorizontal: 2, marginBottom: 8 },
  composer: { minHeight: 54, maxHeight: 126, borderWidth: 1, borderColor: 'rgba(43,48,43,0.18)', borderRadius: 18, backgroundColor: '#F4F3ED', flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, minHeight: 42, maxHeight: 112, color: palette.ink, fontSize: 16, lineHeight: 22, paddingTop: 10, paddingBottom: 8, paddingRight: 8, textAlignVertical: 'top' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: '#B8BCB4' },
  voiceHint: { color: '#8A8E86', fontSize: 12, lineHeight: 17, marginTop: 6, paddingHorizontal: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
