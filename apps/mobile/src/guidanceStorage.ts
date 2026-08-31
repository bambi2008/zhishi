import AsyncStorage from '@react-native-async-storage/async-storage';

import { GuidanceScope } from './api';

const GUIDANCE_ACTION_STORAGE_KEY = 'zhishi.guidance-actions.v1';

export type GuidanceActionStatus = 'planned' | 'in_progress' | 'done' | 'skipped';

export type GuidanceActionRecord = {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  scope: GuidanceScope;
  generatedAt: string;
  headline: string;
  action: string;
  when: string;
  doneWhen: string;
  status: GuidanceActionStatus;
  completedAt?: string | null;
  outcome: string;
  newFact: string;
};

export type GuidanceActionDraft = Pick<
  GuidanceActionRecord,
  'scope' | 'generatedAt' | 'headline' | 'action' | 'when' | 'doneWhen' | 'status' | 'completedAt' | 'outcome' | 'newFact'
>;

function isGuidanceActionStatus(value: unknown): value is GuidanceActionStatus {
  return value === 'planned' || value === 'in_progress' || value === 'done' || value === 'skipped';
}

function isGuidanceActionRecord(value: unknown): value is GuidanceActionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<GuidanceActionRecord>;
  return record.version === 1
    && typeof record.id === 'string'
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string'
    && (record.scope === 'today' || record.scope === 'year')
    && typeof record.generatedAt === 'string'
    && typeof record.headline === 'string'
    && typeof record.action === 'string'
    && typeof record.when === 'string'
    && typeof record.doneWhen === 'string'
    && isGuidanceActionStatus(record.status)
    && (record.completedAt === undefined || record.completedAt === null || typeof record.completedAt === 'string')
    && typeof record.outcome === 'string'
    && typeof record.newFact === 'string';
}

function normalizeDraft(draft: GuidanceActionDraft): GuidanceActionDraft {
  return {
    ...draft,
    generatedAt: draft.generatedAt.trim(),
    headline: draft.headline.trim(),
    action: draft.action.trim(),
    when: draft.when.trim(),
    doneWhen: draft.doneWhen.trim(),
    outcome: draft.outcome.trim(),
    newFact: draft.newFact.trim(),
  };
}

export async function loadGuidanceActions(): Promise<GuidanceActionRecord[]> {
  const raw = await AsyncStorage.getItem(GUIDANCE_ACTION_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isGuidanceActionRecord)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export async function saveGuidanceAction(draft: GuidanceActionDraft): Promise<GuidanceActionRecord> {
  const normalized = normalizeDraft(draft);
  if (!normalized.action || !normalized.generatedAt) {
    throw new Error('缺少要追踪的下一步。');
  }
  const now = new Date().toISOString();
  const record: GuidanceActionRecord = {
    version: 1,
    id: `guidance-action-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    updatedAt: now,
    ...normalized,
  };
  const existing = await loadGuidanceActions();
  await AsyncStorage.setItem(GUIDANCE_ACTION_STORAGE_KEY, JSON.stringify([record, ...existing]));
  return record;
}

export async function updateGuidanceAction(
  id: string,
  patch: Pick<GuidanceActionRecord, 'status' | 'outcome' | 'newFact'>,
): Promise<GuidanceActionRecord> {
  const existing = await loadGuidanceActions();
  const current = existing.find(record => record.id === id);
  if (!current) throw new Error('这条执行记录已经不存在。');
  const updated: GuidanceActionRecord = {
    ...current,
    status: patch.status,
    completedAt: patch.status === 'done' ? (current.completedAt ?? new Date().toISOString()) : null,
    outcome: patch.outcome.trim(),
    newFact: patch.newFact.trim(),
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    GUIDANCE_ACTION_STORAGE_KEY,
    JSON.stringify(existing.map(record => record.id === id ? updated : record)),
  );
  return updated;
}

export async function clearGuidanceActions(): Promise<void> {
  await AsyncStorage.removeItem(GUIDANCE_ACTION_STORAGE_KEY);
}
