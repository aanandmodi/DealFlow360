/**
 * Auth API — login, register, me.
 */

import { apiClient, setTokens, clearTokens } from './client';

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export async function login(username: string, password: string): Promise<User> {
  const tokens = await apiClient<LoginResponse>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setTokens(tokens.access, tokens.refresh);
  return fetchMe();
}

export async function register(data: {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
}): Promise<User> {
  await apiClient('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return login(data.username, data.password);
}

export function fetchMe() {
  return apiClient<User>('/auth/me/');
}

export function logout() {
  clearTokens();
  window.location.href = '/login';
}
