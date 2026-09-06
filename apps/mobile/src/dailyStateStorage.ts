import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_STATE_STORAGE_KEY = 'zhishi.daily-state-records.v1';

export type DailyStateRecord = {
  version: 1;
  id: string;
  localDate: string;
  createdAt: string;
  updatedAt: string;
  energy: number;
  stress: number;
  emotion: string;
  focusArea: string;
  importantEvent: string;
  note: string;
};

export type DailyStateDraft = Pick<
  DailyStateRecord,
  'energy' | 'stress' | 'emotion' | 'focusArea' | 'importantEvent' | 'note'
>;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDailyStateRecord(value: unknown): value is DailyStateRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DailyStateRecord>;
  return record.version === 1
    && typeof record.id === 'string'
    && typeof record.localDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.localDate)
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string'
    && Number.isInteger(record.energy)
    && Number(record.energy) >= 1
    && Number(record.energy) <= 5
    && Number.isInteger(record.stress)
    && Number(record.stress) >= 1
    && Number(record.stress) <= 5
    && typeof record.emotion === 'string'
    && typeof record.focusArea === 'string'
    && typeof record.importantEvent === 'string'
    && typeof record.note === 'string';
}

function normalizeDraft(draft: DailyStateDraft): DailyStateDraft {
  return {
    energy: draft.energy,
    stress: draft.stress,
    emotion: draft.emotion.trim(),
    focusArea: draft.focusArea.trim(),
    importantEvent: draft.importantEvent.trim(),
    note: draft.note.trim(),
  };
}

export async function loadDailyStateRecords(): Promise<DailyStateRecord[]> {
  const raw = await AsyncStorage.getItem(DAILY_STATE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isDailyStateRecord)
      .sort((left, right) => right.localDate.localeCompare(left.localDate));
  } catch {
    return [];
  }
}

export async function saveDailyStateRecord(
  draft: DailyStateDraft,
  localDate = getLocalDateKey(),
): Promise<DailyStateRecord> {
  const normalized = normalizeDraft(draft);
  if (!Number.isInteger(normalized.energy) || normalized.energy < 1 || normalized.energy > 5) {
    throw new Error('请选择 1 到 5 之间的能量状态。');
  }
  if (!Number.isInteger(normalized.stress) || normalized.stress < 1 || normalized.stress > 5) {
    throw new Error('请选择 1 到 5 之间的压力状态。');
  }
  if (!normalized.emotion || !normalized.focusArea) {
    throw new Error('请选择今天最接近的感受和关注领域。');
  }

  const existing = await loadDailyStateRecords();
  const current = existing.find(record => record.localDate === localDate);
  const now = new Date().toISOString();
  const record: DailyStateRecord = current ? {
    ...current,
    ...normalized,
    updatedAt: now,
  } : {
    version: 1,
    id: `daily-state-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    localDate,
    createdAt: now,
    updatedAt: now,
    ...normalized,
  };
  const next = current
    ? existing.map(item => item.id === current.id ? record : item)
    : [record, ...existing];
  await AsyncStorage.setItem(DAILY_STATE_STORAGE_KEY, JSON.stringify(next));
  return record;
}

export async function deleteDailyStateRecord(id: string): Promise<void> {
  const existing = await loadDailyStateRecords();
  await AsyncStorage.setItem(
    DAILY_STATE_STORAGE_KEY,
    JSON.stringify(existing.filter(record => record.id !== id)),
  );
}

export async function clearDailyStateRecords(): Promise<void> {
  await AsyncStorage.removeItem(DAILY_STATE_STORAGE_KEY);
}
