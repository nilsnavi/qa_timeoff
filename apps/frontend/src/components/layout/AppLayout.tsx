import { useQuery } from '@tanstack/react-query';
import { Bell, Bug, CalendarDays, ClipboardList, Home, Plus, Shield, UserRound, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, Header, Toast } from '../ui';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';
import { cleanupTelegramApp, getTelegramInitData, hapticSelection, setupTelegramApp, useTelegramBackButton } from '../../shared/utils/telegram';
import { TelegramDebug } from '../TelegramDebug';

const navItems = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/balance', label: 'Баланс', icon: WalletCards },
  { to: '/requests', label: 'Заявки', icon: ClipboardList },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/profile', label: 'Профиль', icon: UserRound },
];

const DEV_SKIP_KEY = 'qa-timeoff-dev-skip';

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading, authError, login } = useAuth();
  const [initDataMissing, setInitDataMissing] = useState(false);
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: 'success' | 'error' | 'info' } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const handleBack = useCallback(() => navigate(-1), [navigate]);
  const isDev = import.meta.env.DEV;
  const loginTriggeredRef = useRef(false);

  useTelegramBackButton(location.pathname !== '/', handleBack);

  // ── Telegram init ────────────────────────────────────────────────────
  useEffect(() => {
    setupTelegramApp();
    return cleanupTelegramApp;
  }, []);

  // ── Toast listener ───────────────────────────────────────────────────
  useEffect(() => {
    const listener = (event: Event) => {
      const nextToast = (event as CustomEvent<typeof toast>).detail;
      setToast(nextToast);
      window.setTimeout(() => setToast(null), 2600);
    };

    window.addEventListener('qa-timeoff-toast', listener);
    return () => window.removeEventListener('qa-timeoff-toast', listener);
  }, []);

  // ── Auth trigger ─────────────────────────────────────────────────────
  // Once the AuthProvider has finished its initial validation (isAuthLoading
  // is false) and we are still not authenticated, try to obtain an initData
  // from Telegram and kick off the login flow.
  useEffect(() => {
    // Prevent double-fire in StrictMode
    if (loginTriggeredRef.current) return;
    if (isAuthLoading) return;
    if (isAuthenticated) return;

    // Dev skip bypass
    if (isDev && localStorage.getItem(DEV_SKIP_KEY) === 'true') return;

    const initData = getTelegramInitData();
    if (initData) {
      loginTriggeredRef.current = true;
      login(initData).catch(() => {
        /* error is captured via authError in context */
      });
    } else if (isDev) {
      // In dev mode with no initData — check if a token already exists
      // (AuthProvider already handled this, so if we're here, there's no token)
      // Show the initData UI which includes dev options
      setInitDataMissing(true);
    } else {
      setInitDataMissing(true);
    }
  }, [isAuthLoading, isAuthenticated, login, isDev]);

  // ── Dashboard (loaded only when authenticated) ──────────────────────
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  // ── Dev init input state ─────────────────────────────────────────────
  const [devInitInput, setDevInitInput] = useState('');

  const handleDevInitSubmit = () => {
    if (!devInitInput.trim()) return;
    localStorage.setItem('qa-timeoff-dev-init', devInitInput.trim());
    window.location.reload();
  };

  const handleDevSkip = () => {
    localStorage.setItem(DEV_SKIP_KEY, 'true');
    localStorage.setItem('qa-timeoff-onboarding-complete', 'true');
    window.location.reload();
  };

  // ── Render: loading ──────────────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <p className="text-sm text-slate-500">Авторизация...</p>
        </div>
      </main>
    );
  }

  // ── Render: error (stale token or login failure) ─────────────────────
  if (authError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-4 rounded-2xl bg-rose-50 p-6 shadow-soft ring-1 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-800">
          <h1 className="text-center text-lg font-bold text-rose-700 dark:text-rose-300">
            Ошибка авторизации
          </h1>
          <p className="text-center text-sm text-rose-600 dark:text-rose-400">
            {authError}
          </p>
          <div className="space-y-2 rounded-xl bg-white/70 p-3 text-xs dark:bg-slate-900/50">
            <div className="flex justify-between">
              <span className="text-slate-500">initData.length</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {window.Telegram?.WebApp?.initData?.length ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">userAgent</span>
              <span className="font-mono max-w-[60%] truncate text-slate-700 dark:text-slate-300">{navigator.userAgent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">URL</span>
              <span className="font-mono max-w-[60%] truncate text-slate-700 dark:text-slate-300">{window.location.href}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft active:scale-95"
          >
            Попробовать снова
          </button>
          <TelegramDebug />
        </div>
      </main>
    );
  }

  // ── Render: initData missing (not in Telegram) ───────────────────────
  if (initDataMissing && !isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-4 rounded-2xl bg-rose-50 p-6 shadow-soft ring-1 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-800">
          <h1 className="text-center text-lg font-bold text-rose-700 dark:text-rose-300">
            Ошибка запуска приложения
          </h1>
          <p className="text-center text-sm text-rose-600 dark:text-rose-400">
            Приложение должно быть открыто через Telegram Mini App
          </p>
          <div className="space-y-2 rounded-xl bg-white/70 p-3 text-xs dark:bg-slate-900/50">
            <div className="flex justify-between">
              <span className="text-slate-500">initData</span>
              <span className="font-mono text-rose-600">отсутствует</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">initData.length</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">userAgent</span>
              <span className="font-mono max-w-[60%] truncate text-slate-700 dark:text-slate-300">{navigator.userAgent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">URL</span>
              <span className="font-mono max-w-[60%] truncate text-slate-700 dark:text-slate-300">{window.location.href}</span>
            </div>
          </div>
          <TelegramDebug />

          {isDev && (
            <div className="space-y-3 rounded-xl bg-sky-50 p-4 dark:bg-sky-950/40">
              <p className="text-center text-sm font-medium text-sky-700 dark:text-sky-300">
                🔧 Dev-режим: вставьте initData или пропустите
              </p>
              <textarea
                value={devInitInput}
                onChange={(e) => setDevInitInput(e.target.value)}
                placeholder="Вставьте initData из Telegram Web App..."
                rows={3}
                className="w-full rounded-lg border border-sky-200 bg-white p-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDevInitSubmit}
                  className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft active:scale-95"
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={handleDevSkip}
                  className="flex-1 rounded-xl bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-600 shadow-soft ring-1 ring-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                >
                  Пропустить (dev)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Render: dev skip placeholder ─────────────────────────────────────
  const isDevSkip = isDev && localStorage.getItem(DEV_SKIP_KEY) === 'true';
  if (isDevSkip) {
    return <DevPlaceholder />;
  }

  // ── Render: loading dashboard ────────────────────────────────────────
  if (!dashboardQuery.data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <p className="text-sm text-slate-500">Загрузка...</p>
        </div>
      </main>
    );
  }

  const dashboard = dashboardQuery.data;
  const unread = dashboard.notifications.filter((item) => !item.isRead).length;
  const pendingRequests =
    dashboard.requests.filter((request) => request.status === 'PENDING').length +
    (dashboard.vacations ?? []).filter((request) => request.status === 'PENDING').length;

  return (
    <main className="mx-auto flex min-h-[var(--tg-viewport-height)] w-full max-w-xl flex-col px-4 pb-28 pt-4 safe-area">
      <Header
        eyebrow="QA TimeOff"
        title={`Привет, ${dashboard.user.fullName.split(' ')[0]}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex h-10 min-w-[108px] max-w-[130px] items-center justify-center rounded-pill border border-white/10 bg-white/[0.06] px-3">
              <img src="/dm-logo.svg" alt="Деловые Линии" className="max-h-5 w-full object-contain opacity-80" />
            </div>
            <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.10] hover:text-white">
              <button
                type="button"
                aria-label="Уведомления"
                className="grid h-full w-full place-items-center rounded-xl"
                onClick={() => {
                  hapticSelection();
                  navigate('/notifications');
                }}
              >
                <Bell size={18} />
              </button>
              {!!unread && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/40" />
              )}
            </div>
          </div>
        }
      />

      <div className="grid gap-4">{children}</div>

      {/* Floating Action Button */}
      <NavLink
        to="/timeoff/new"
        onClick={() => hapticSelection()}
        className="fixed bottom-[calc(6rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] right-[calc(50%-17rem)] z-20 grid h-12 w-12 place-items-center rounded-xl app-gradient text-white shadow-lg shadow-blue-500/30 animate-pulse-glow max-[600px]:right-5"
      >
        <Plus size={20} />
      </NavLink>

      <BottomNavigation
        items={navItems.map((item) => ({
          ...item,
          active: item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
          badge: item.to === '/requests' ? pendingRequests : undefined,
          onClick: () => {
            hapticSelection();
            navigate(item.to);
          },
        }))}
      />

      {dashboard.user.role === 'ADMIN' && (
        <NavLink
          to="/admin"
          onClick={() => hapticSelection()}
          className="fixed bottom-[calc(6rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] left-[calc(50%-17rem)] z-20 grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-slate-700 shadow-soft max-[600px]:left-5"
        >
          <Shield size={21} />
        </NavLink>
      )}
      {toast && <Toast title={toast.title} message={toast.message} tone={toast.tone} />}
    </main>
  );
}

// --- Dev mode placeholder page (shown when skipping Telegram auth) ---
export function DevPlaceholder() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
      <div className="w-full space-y-6 rounded-2xl bg-sky-50 p-8 shadow-soft ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-800">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/25">
          <Bug size={36} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">🔧 Dev-режим</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Приложение открыто вне Telegram Mini App.<br />
            Для полноценной работы запустите бэкенд и откройте через Telegram.
          </p>
        </div>
        <div className="rounded-xl bg-white/70 p-4 text-xs dark:bg-slate-900/50">
          <TelegramDebug />
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(DEV_SKIP_KEY);
            localStorage.removeItem('qa-timeoff-dev-init');
            localStorage.removeItem('qa-timeoff-onboarding-complete');
            window.location.reload();
          }}
          className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft active:scale-95"
        >
          Сбросить dev-режим
        </button>
      </div>
    </main>
  );
}
