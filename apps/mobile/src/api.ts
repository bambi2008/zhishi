export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

export type ApiHealth = {
  status: string;
  service: string;
  version: string;
};

export class ZhishiApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ZhishiApiError';
    this.status = status;
    this.code = code;
  }
}

export type SolarTimeMode = 'civil' | 'mean_solar' | 'apparent_solar';
export type DayBoundaryRule = 'midnight' | 'late_zi_next_day';
export type BaziGender = 'male' | 'female';
export type LuckStartRule = 'precise_minutes' | 'traditional_segments';
export type BaziTimeAccuracy = 'exact' | 'approximate' | 'hour_only';

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
  gender?: BaziGender;
  luck_direction_override?: 'forward' | 'reverse';
  luck_start_rule?: LuckStartRule;
  time_accuracy?: BaziTimeAccuracy;
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
    timezone_database: string;
    solar_time_mode: SolarTimeMode;
    day_boundary: DayBoundaryRule;
    luck_start_rule: LuckStartRule;
  };
  luck_cycles?: {
    status: 'ok' | 'audit_failed';
    user_visible: boolean;
    direction: 'forward' | 'reverse';
    direction_basis: string;
    year_stem_yin_yang: 'yang' | 'yin';
    start_rule: LuckStartRule;
    start_boundary: {
      name: string;
      boundary_time_utc: string;
      distance_seconds: number;
      source: string;
    };
    birth_to_boundary_seconds: number;
    start_age: LuckStartAge;
    start_at_local: string;
    periods: Array<{
      index: number;
      pillar: BaziPillar;
      start_at_local: string;
      end_at_local_exclusive: string;
      start_age: LuckStartAge;
    }>;
    audit: {
      status: 'passed' | 'failed';
      primary_engine: string;
      verification_engine: string;
      checks: Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }>;
    };
  } | null;
  calculation_hash: string;
};

export type LuckStartAge = {
  years: number;
  months: number;
  days: number;
  hours: number;
  decimal_years: number;
};

export type LuckPeriod = {
  index: number;
  pillar: BaziPillar;
  start_at_local: string;
  end_at_local_exclusive: string;
  start_age: LuckStartAge;
};

export type BaziCurrentContextResult = {
  status: 'ok' | 'audit_failed';
  user_visible: boolean;
  as_of_utc: string;
  as_of_local: string;
  chart: BaziCalculationResult;
  current_luck: {
    status: 'pre_luck' | 'active' | 'out_of_range';
    current_period?: LuckPeriod | null;
    next_period?: LuckPeriod | null;
    next_transition_local?: string | null;
  };
  annual_cycle: {
    label_year: number;
    pillar: BaziPillar;
    start_boundary: { name: string; boundary_time_utc: string; distance_seconds: number; source: string };
    end_boundary: { name: string; boundary_time_utc: string; distance_seconds: number; source: string };
  };
  monthly_cycle: {
    sequence_from_lichun: number;
    pillar: BaziPillar;
    start_boundary: { name: string; boundary_time_utc: string; distance_seconds: number; source: string };
    end_boundary: { name: string; boundary_time_utc: string; distance_seconds: number; source: string };
  };
  audit: {
    status: 'passed' | 'failed';
    primary_engine: string;
    verification_engine: string;
    checks: Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }>;
  };
};

export type InterpretationFocus = 'overview' | 'career' | 'relationships' | 'wellbeing';

export type BaziInterpretationResult = {
  status: 'ok';
  generated_at: string;
  as_of_utc: string;
  calculation_hash: string;
  model: string;
  disclosure: string;
  uncertainty_notice: string;
  professional_advice_notice: string;
  summary: string;
  sections: Array<{
    id: string;
    title: string;
    interpretation: string;
    evidence_ids: string[];
    reflection_questions: string[];
  }>;
  cautions: string[];
  evidence_catalog: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  usage: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  };
};

export type ReflectionConversationMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export type ReflectionOption = {
  title: string;
  when_it_fits: string;
  tradeoff: string;
};

export type ReflectionEvidence = {
  id: string;
  label: string;
  value: string;
};

export type ReflectionTurnResult = {
  status: 'ok';
  phase: 'clarify' | 'synthesis';
  generated_at: string;
  model: string;
  headline: string;
  what_i_heard: string;
  hypothesis: string;
  evidence_ids: string[];
  clarification_question?: string | null;
  options: ReflectionOption[];
  next_step?: string | null;
  verification_question?: string | null;
  cautions: string[];
  disclosure: string;
  professional_advice_notice: string;
  evidence_catalog: ReflectionEvidence[];
  usage: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  };
};

export type ReflectionTurnRequest = {
  fact: string;
  emotion: string;
  interpretation: string;
  worry: string;
  nextQuestion: string;
  conversation: ReflectionConversationMessage[];
  responseMode?: 'auto' | 'synthesize';
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
    const body = await response.json().catch(() => null) as {
      detail?: string | { code?: string; message?: string };
    } | null;
    const structuredDetail = typeof body?.detail === 'object' ? body.detail : undefined;
    const detail = typeof body?.detail === 'string' ? body.detail : structuredDetail?.message;
    throw new ZhishiApiError(
      detail ?? `知时 API 请求失败：${response.status}`,
      response.status,
      structuredDetail?.code,
    );
  }

  return response.json() as Promise<T>;
}

export function getApiHealth(): Promise<ApiHealth> {
  return request<ApiHealth>('/health');
}

export function searchBirthLocations(query: string, signal?: AbortSignal): Promise<LocationSearchResult[]> {
  return request<LocationSearchResult[]>('/api/v1/locations/search', {
    method: 'POST',
    body: JSON.stringify({ query, language: 'zh', limit: 6 }),
    signal,
  });
}

export function calculateBaziChart(payload: BaziCalculationInput): Promise<BaziCalculationResult> {
  return request<BaziCalculationResult>('/api/v1/bazi/charts/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function calculateBaziCurrentContext(
  chart: BaziCalculationInput,
  asOfUtc = new Date().toISOString(),
): Promise<BaziCurrentContextResult> {
  return request<BaziCurrentContextResult>('/api/v1/bazi/context/current', {
    method: 'POST',
    body: JSON.stringify({ chart, as_of_utc: asOfUtc }),
  });
}

export function generateBaziInterpretation(
  chart: BaziCalculationInput,
  focusAreas: InterpretationFocus[],
  question: string,
  asOfUtc = new Date().toISOString(),
): Promise<BaziInterpretationResult> {
  return request<BaziInterpretationResult>('/api/v1/bazi/interpretations/generate', {
    method: 'POST',
    body: JSON.stringify({
      chart,
      as_of_utc: asOfUtc,
      language: 'zh-CN',
      focus_areas: focusAreas,
      question: question.trim() || null,
      acknowledged_ai_processing: true,
    }),
  });
}

export function generateReflectionTurn(payload: ReflectionTurnRequest): Promise<ReflectionTurnResult> {
  return request<ReflectionTurnResult>('/api/v1/reflections/conversation/turn', {
    method: 'POST',
    body: JSON.stringify({
      fact: payload.fact,
      emotion: payload.emotion,
      interpretation: payload.interpretation,
      worry: payload.worry,
      next_question: payload.nextQuestion,
      conversation: payload.conversation,
      response_mode: payload.responseMode ?? 'auto',
      language: 'zh-CN',
      acknowledged_ai_processing: true,
    }),
  });
}
