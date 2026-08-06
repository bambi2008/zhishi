export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

export type ApiHealth = {
  status: string;
  service: string;
  version: string;
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
    throw new Error(`知时 API 请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getApiHealth(): Promise<ApiHealth> {
  return request<ApiHealth>('/health');
}
