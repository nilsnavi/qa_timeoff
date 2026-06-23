import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, setAccessToken, clearAccessToken } from '../api';
import type { User } from '../types';

export interface AuthState {
  /** JWT token, if available */
  token: string | null;
  /** Decoded user profile from /auth/me */
  user: User | null;
  /** true when token exists AND /auth/me resolved successfully */
  isAuthenticated: boolean;
  /** true while the initial token validation or login is in progress */
  isAuthLoading: boolean;
  /** Human-readable auth error message, or null */
  authError: string | null;
}

export interface AuthContextValue extends AuthState {
  /** Authenticate via Telegram initData */
  login: (initData: string) => Promise<void>;
  /** Clear auth state without redirect */
  logout: () => void;
  /** Clear auth state and redirect to root */
  clearAuth: () => void;
}

const CTX = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Track if initial validation has been attempted (prevents double-run in StrictMode)
  const validatedRef = useRef(false);

  // ── Initial token validation ──────────────────────────────────────────
  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;

    const stored = localStorage.getItem('qa-timeoff-token');
    if (!stored) {
      setIsAuthLoading(false);
      return;
    }

    // Restore the token into memory so request() can use it
    setAccessToken(stored);
    setToken(stored);

    api
      .me()
      .then((profile) => {
        if (!profile.id || !profile.telegramId) {
          throw new Error('Некорректные данные профиля');
        }
        setUser(profile);
      })
      .catch((err) => {
        // 401 or any network failure → stale / invalid token
        const status = (err as { statusCode?: number }).statusCode;
        clearAccessToken();
        localStorage.removeItem('qa-timeoff-token');
        setToken(null);

        if (status === 401) {
          setAuthError('Сессия истекла. Откройте приложение заново через Telegram.');
        } else {
          setAuthError('Не удалось проверить авторизацию. Проверьте подключение.');
        }
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, []);

  // ── Login via Telegram initData ───────────────────────────────────────
  const login = useCallback(async (initData: string) => {
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const authResult = await api.auth(initData);
      const newToken = authResult.accessToken ?? authResult.token;
      if (!newToken) {
        throw new Error('Токен авторизации не получен');
      }

      setAccessToken(newToken);
      localStorage.setItem('qa-timeoff-token', newToken);
      setToken(newToken);

      // Immediately fetch the profile so the rest of the app can use it
      const profile = await api.me();
      if (!profile.id || !profile.telegramId) {
        throw new Error('Некорректные данные профиля');
      }
      setUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации';
      setAuthError(message);
      clearAccessToken();
      localStorage.removeItem('qa-timeoff-token');
      setToken(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearAccessToken();
    localStorage.removeItem('qa-timeoff-token');
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const clearAuth = useCallback(() => {
    logout();
    window.location.assign('/');
  }, [logout]);

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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(CTX);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
