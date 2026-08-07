export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

export type ApiHealth = {
  status: string;
  service: string;
  version: string;
};

export type SolarTimeMode = 'civil' | 'mean_solar' | 'apparent_solar';
export type DayBoundaryRule = 'midnight' | 'late_zi_next_day';

export type LocationSearchResult = {
  provider_id: number;
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
  iana_timezone: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  provider: 'open-meteo-geonames';
  attribution: string;
};

export type BaziCalculationInput = {
  local_datetime: string;
  iana_timezone: string;
  longitude: number;
  latitude?: number;
  birth_location_name?: string;
  time_accuracy?: 'exact' | 'approximate' | 'hour_only';
  uncertainty_minutes?: number;
  dst_fold?: 0 | 1;
  solar_time_mode: SolarTimeMode;
  day_boundary_rule: DayBoundaryRule;
};

export type BaziPillar = {
  value: string;
  stem: string;
  branch: string;
  stem_element: string;
  branch_element: string;
  hidden_stems: string[];
  stem_ten_god: string;
  hidden_stem_ten_gods: string[];
  na_yin: string;
};

export type BaziCalculationResult = {
  status: 'ok' | 'ambiguous' | 'audit_failed';
  user_visible: boolean;
  normalized_times: {
    civil_time: string;
    utc_time: string;
    mean_solar_time: string;
    apparent_solar_time: string;
    selected_time: string;
    selected_mode: SolarTimeMode;
    utc_offset_minutes: number;
    longitude_offset_from_utc_minutes: number;
    mean_solar_correction_minutes: number;
    equation_of_time_minutes: number;
    total_apparent_correction_minutes: number;
  };
  pillars: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    hour: BaziPillar;
    day_master: string;
  };
  boundary: {
    nearest_jie: {
      name: string;
      boundary_time_utc: string;
      distance_seconds: number;
      source: string;
    };
    uncertainty_seconds: number;
    crosses_jie_boundary: boolean;
    crosses_hour_boundary: boolean;
    crosses_day_boundary: boolean;
    risk: 'none' | 'near_boundary' | 'ambiguous';
    notes: string[];
  };
  alternatives: Array<{
    label: string;
    selected_time: string;
    year: string;
    month: string;
    day: string;
    hour: string;
  }>;
  audit: {
    status: 'passed' | 'failed';
    primary_engine: string;
    verification_engine: string;
    checks: Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }>;
  };
  rule_profile: {
    profile_id: string;
    solar_time_mode: SolarTimeMode;
    day_boundary: DayBoundaryRule;
  };
  calculation_hash: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string | { message?: string } } | null;
    const detail = typeof body?.detail === 'string' ? body.detail : body?.detail?.message;
    throw new Error(detail ?? `知时 API 请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getApiHealth(): Promise<ApiHealth> {
  return request<ApiHealth>('/health');
}

export function searchBirthLocations(query: string, signal?: AbortSignal): Promise<LocationSearchResult[]> {
  const params = new URLSearchParams({ q: query, language: 'zh', limit: '6' });
  return request<LocationSearchResult[]>(`/api/v1/locations/search?${params.toString()}`, { signal });
}

export function calculateBaziChart(payload: BaziCalculationInput): Promise<BaziCalculationResult> {
  return request<BaziCalculationResult>('/api/v1/bazi/charts/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
