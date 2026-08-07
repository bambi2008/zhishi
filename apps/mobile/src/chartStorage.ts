import AsyncStorage from '@react-native-async-storage/async-storage';

import { BaziCalculationInput, BaziCalculationResult } from './api';


const CHART_STORAGE_KEY = 'zhishi.bazi-chart.v1';

export type StoredBaziChart = {
  version: 1;
  saved_at: string;
  input: BaziCalculationInput;
  result: BaziCalculationResult;
};

export async function loadStoredBaziChart(): Promise<StoredBaziChart | null> {
  const raw = await AsyncStorage.getItem(CHART_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBaziChart>;
    if (parsed.version !== 1 || !parsed.saved_at || !parsed.input || !parsed.result) return null;
    return parsed as StoredBaziChart;
  } catch {
    return null;
  }
}

export async function saveStoredBaziChart(
  input: BaziCalculationInput,
  result: BaziCalculationResult,
): Promise<StoredBaziChart> {
  const stored: StoredBaziChart = {
    version: 1,
    saved_at: new Date().toISOString(),
    input,
    result,
  };
  await AsyncStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export async function clearStoredBaziChart(): Promise<void> {
  await AsyncStorage.removeItem(CHART_STORAGE_KEY);
}
