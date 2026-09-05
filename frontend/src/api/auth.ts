/**
 * Auth API — login, register, refresh, current user.
 */
import { ApiClient } from './client';

// Use a type alias with a runtime dummy to ensure esbuild keeps the export
export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'sales_rep' | 'sales_manager' | 'finance' | 'customer';
  phone: string;
  avatar_url: string;
};

export type AuthResponse = {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
};

export const authApi = {
  login: (username: string, password: string) =>
    ApiClient.post<AuthResponse>('/auth/login/', { username, password }),

  register: (data: { username: string; email: string; password: string; first_name: string; last_name: string; role: string }) =>
    ApiClient.post<AuthResponse>('/auth/register/', data),

  me: () => ApiClient.get<User>('/auth/me/'),

  users: (role?: string) => ApiClient.get<User[]>(`/auth/users/${role ? `?role=${role}` : ''}`),
};

export const login = authApi.login;
export const register = authApi.register;
export const me = authApi.me;
