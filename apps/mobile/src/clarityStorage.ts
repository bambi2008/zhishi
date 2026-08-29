import AsyncStorage from '@react-native-async-storage/async-storage';

const CLARITY_STORAGE_KEY = 'zhishi.clarity-records.v1';

export type ClarityRecord = {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  fact: string;
  emotion: string;
  interpretation: string;
  worry: string;
  nextQuestion: string;
};

export type ClarityRecordDraft = Pick<
  ClarityRecord,
  'fact' | 'emotion' | 'interpretation' | 'worry' | 'nextQuestion'
>;

function isClarityRecord(value: unknown): value is ClarityRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ClarityRecord>;
  return record.version === 1
    && typeof record.id === 'string'
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string'
    && typeof record.fact === 'string'
    && typeof record.emotion === 'string'
    && typeof record.interpretation === 'string'
    && typeof record.worry === 'string'
    && typeof record.nextQuestion === 'string';
}

function normalizeDraft(draft: ClarityRecordDraft): ClarityRecordDraft {
  return {
    fact: draft.fact.trim(),
    emotion: draft.emotion.trim(),
    interpretation: draft.interpretation.trim(),
    worry: draft.worry.trim(),
    nextQuestion: draft.nextQuestion.trim(),
  };
}

export async function loadClarityRecords(): Promise<ClarityRecord[]> {
  const raw = await AsyncStorage.getItem(CLARITY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isClarityRecord)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

export async function saveClarityRecord(draft: ClarityRecordDraft): Promise<ClarityRecord> {
  const normalized = normalizeDraft(draft);
  if (!normalized.fact || !normalized.emotion) {
    throw new Error('请先写下事实并选择一种感受。');
  }

  const now = new Date().toISOString();
  const record: ClarityRecord = {
    version: 1,
    id: `clarity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    updatedAt: now,
    ...normalized,
  };
  const existing = await loadClarityRecords();
  await AsyncStorage.setItem(CLARITY_STORAGE_KEY, JSON.stringify([record, ...existing]));
  return record;
}

export async function updateClarityRecord(
  id: string,
  draft: ClarityRecordDraft,
): Promise<ClarityRecord> {
  const normalized = normalizeDraft(draft);
  if (!normalized.fact || !normalized.emotion) {
    throw new Error('请先写下事实并选择一种感受。');
  }

  const existing = await loadClarityRecords();
  const current = existing.find(record => record.id === id);
  if (!current) {
    throw new Error('这条记录已经不存在，无法继续修改。');
  }

  const updated: ClarityRecord = {
    ...current,
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    CLARITY_STORAGE_KEY,
    JSON.stringify(existing.map(record => record.id === id ? updated : record)),
  );
  return updated;
}

export async function deleteClarityRecord(id: string): Promise<void> {
  const existing = await loadClarityRecords();
  await AsyncStorage.setItem(
    CLARITY_STORAGE_KEY,
    JSON.stringify(existing.filter(record => record.id !== id)),
  );
}

export async function clearClarityRecords(): Promise<void> {
  await AsyncStorage.removeItem(CLARITY_STORAGE_KEY);
}
