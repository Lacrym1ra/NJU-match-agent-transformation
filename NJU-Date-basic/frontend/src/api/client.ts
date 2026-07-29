import { getToken, clearToken } from './token';
import { toast } from '../components/Toast';

const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const BASE_URL = viteEnv.VITE_API_BASE || 'http://localhost:3000/api/v1';
const USE_MOCK = viteEnv.VITE_USE_MOCK === 'true';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
    public retryAt?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function formatRetryAt(retryAt?: string): string | null {
  if (!retryAt) return null;
  const time = new Date(retryAt);
  if (Number.isNaN(time.getTime())) return null;
  return time.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeErrorMessage(code: string, message: string, retryAt?: string): string {
  if (code !== 'REQUEST_RATE_LIMITED') return message;
  const formattedRetryAt = formatRetryAt(retryAt);
  return formattedRetryAt ? `${message}（${formattedRetryAt} 后可重试）` : message;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (USE_MOCK) {
    console.log(`[Mock API] ${options.method || 'GET'} ${path}`);
    const { mockRequest } = await import('./mock');
    return mockRequest(path, options);
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    clearToken();
    toast.warning('登录已过期，请重新登录');
    window.location.href = '/login';
    throw new ApiError(401, 'UNAUTHORIZED', '登录已过期，请重新登录');
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  let data: any = null;

  if (res.status !== 204) {
    if (isJson) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text();
      data = text ? { message: text } : null;
    }
  }

  if (!res.ok) {
    const err = data?.error || {};
    const code = err.code || 'UNKNOWN';
    const retryAt = err.retryAt || data?.retryAt;
    const message = normalizeErrorMessage(code, err.message || data?.message || '请求失败', retryAt);
    throw new ApiError(res.status, code, message, err.details, retryAt);
  }

  return (data ?? {}) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postWithHeaders: <T>(path: string, body: unknown, headers: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, { method: 'POST', body }),
};
