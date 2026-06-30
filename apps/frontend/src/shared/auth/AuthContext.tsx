import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, setAccessToken, clearAccessToken, setOnUnauthorized } from '../api';
import type { User } from '../types';

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  mustChangePassword: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearAuth: () => void;
  setMustChangePassword: (v: boolean) => void;
  setAuthFromResponse: (data: { accessToken: string; refreshToken: string; user: User }) => void;
}

const CTX = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const validatedRef = useRef(false);

  const performLogout = useCallback(() => {
    api.logout().catch(() => {});
    clearAccessToken();
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const handleUnauthorized = useCallback(() => {
    performLogout();
    window.location.assign('/login');
  }, [performLogout]);

  setOnUnauthorized(handleUnauthorized);

  const tryRefreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const result = await api.refreshToken();
      setAccessToken(result.accessToken);
      setToken(result.accessToken);
      return result.accessToken;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;

    async function init() {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const profile = await api.me();
        if (!profile.id) throw new Error('Некорректные данные профиля');
        setUser(profile);
      } catch {
        clearAccessToken();
        setToken(null);
        setAuthError('Сессия истекла. Выполните вход заново.');
      } finally {
        setIsAuthLoading(false);
      }
    }

    init();
  }, [tryRefreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const authResult = await api.login(email, password);
      const newToken = authResult.accessToken;
      if (!newToken) throw new Error('Токен авторизации не получен');

      setAccessToken(newToken);
      setToken(newToken);
      setUser(authResult.user);
      setMustChangePassword(authResult.mustChangePassword ?? false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации';
      setAuthError(message);
      clearAccessToken();
      setToken(null);
      throw err;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    performLogout();
  }, [performLogout]);

  const clearAuth = useCallback(() => {
    performLogout();
    window.location.assign('/login');
  }, [performLogout]);

  const setAuthFromResponse = useCallback((data: { accessToken: string; refreshToken: string; user: User }) => {
    setAccessToken(data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    setMustChangePassword((data.user as any).mustChangePassword ?? false);
  }, []);

  const isAuthenticated = !!token && !!user;

  return (
    <CTX.Provider
      value={{
        token,
        user,
        isAuthenticated,
        isAuthLoading,
        authError,
        mustChangePassword,
        login,
        logout,
        clearAuth,
        setMustChangePassword,
        setAuthFromResponse,
      }}
    >
      {children}
    </CTX.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(CTX);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
