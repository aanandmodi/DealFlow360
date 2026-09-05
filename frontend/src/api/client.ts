/**
 * Base API client — JWT header injection, error handling.
 */
const BASE_URL = '/api';

interface ApiError {
  detail?: string;
  message?: string;
  [key: string]: unknown;
}

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  static setTokens(access: string, refresh: string) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  static clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  static async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Try refresh
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${BASE_URL}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem('access_token', data.access);
            headers['Authorization'] = `Bearer ${data.access}`;
            const retryRes = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
            if (!retryRes.ok) throw await retryRes.json();
            return retryRes.json();
          }
        } catch {
          this.clearTokens();
          window.location.href = '/login';
        }
      }
      this.clearTokens();
      window.location.href = '/login';
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw error;
    }

    return response.json();
  }

  static get<T>(endpoint: string) {
    return this.fetch<T>(endpoint);
  }

  static post<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static put<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static patch<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(endpoint: string) {
    return this.fetch<T>(endpoint, { method: 'DELETE' });
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export function setTokens(access: string, refresh: string) {
  ApiClient.setTokens(access, refresh);
}

export function clearTokens() {
  ApiClient.clearTokens();
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('access_token');
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, ...init } = options;
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += (url.includes('?') ? '&' : '?') + searchParams.toString();
  }
  return ApiClient.fetch<T>(url, init);
}
