/**
 * Auth context — manages login state, user, tokens.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../api/client';

// Define User type inline to avoid esbuild import stripping issues
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'sales_rep' | 'sales_manager' | 'finance' | 'customer';
  phone: string;
  avatar_url: string;
}

interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

const authApiInline = {
  login: (username: string, password: string) =>
    ApiClient.post<AuthResponse>('/auth/login/', { username, password }),
  me: () => ApiClient.get<User>('/auth/me/'),
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    const token = sessionStorage.getItem('access_token');
    if (token) {
      authApiInline.me()
        .then(setUser)
        .catch(() => {
          ApiClient.clearTokens();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authApiInline.login(username, password);
    ApiClient.setTokens(res.tokens.access, res.tokens.refresh);
    queryClient.clear();
    setUser(res.user);
  };

  const logout = () => {
    const refresh = sessionStorage.getItem('refresh_token');
    if (refresh) ApiClient.post('/auth/logout/', {refresh}).catch(() => {});
    queryClient.clear();
    ApiClient.clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
