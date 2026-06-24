import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, setAccessToken, clearAccessToken, setOnUnauthorized } from '../api';
import type { User } from '../types';

const TOKEN_KEY = 'qa-timeoff-token';
const REFRESH_KEY = 'qa-timeoff-refresh';

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearAuth: () => void;
}

const CTX = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const validatedRef = useRef(false);

  const performLogout = useCallback(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      api.logout(refreshToken).catch(() => {});
    }
    clearAccessToken();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
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
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) return null;

    try {
      const result = await api.refreshToken(storedRefresh);
      setAccessToken(result.accessToken);
      localStorage.setItem(TOKEN_KEY, result.accessToken);
      localStorage.setItem(REFRESH_KEY, result.refreshToken);
      setToken(result.accessToken);
      return result.accessToken;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;

    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsAuthLoading(false);
      return;
    }

    setAccessToken(stored);
    setToken(stored);

    api
      .me()
      .then((profile) => {
        if (!profile.id) throw new Error('Некорректные данные профиля');
        setUser(profile);
      })
      .catch(async (err) => {
        const status = (err as { statusCode?: number }).statusCode;

        if (status === 401) {
          const refreshed = await tryRefreshToken();
          if (refreshed) {
            try {
              const profile = await api.me();
              if (!profile.id) throw new Error('Некорректные данные профиля');
              setUser(profile);
              return;
            } catch {
              // refresh succeeded but /me failed — continue to logout
            }
          }
        }

        clearAccessToken();
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        setToken(null);

        if (status === 401 || status === 403) {
          setAuthError('Сессия истекла. Выполните вход заново.');
        } else {
          setAuthError('Не удалось проверить авторизацию. Проверьте подключение.');
        }
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, [tryRefreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const authResult = await api.login(email, password);
      const newToken = authResult.accessToken;
      if (!newToken) throw new Error('Токен авторизации не получен');

      setAccessToken(newToken);
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(REFRESH_KEY, authResult.refreshToken);
      setToken(newToken);
      setUser(authResult.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации';
      setAuthError(message);
      clearAccessToken();
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
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

  const isAuthenticated = !!token && !!user;

  return (
    <CTX.Provider
      value={{
        token,
        user,
        isAuthenticated,
        isAuthLoading,
        authError,
        login,
        logout,
        clearAuth,
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
