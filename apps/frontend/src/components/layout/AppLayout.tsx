import { useQuery } from '@tanstack/react-query';
import { Bell, Bug, CalendarDays, ClipboardList, Home, Plus, Shield, UserRound, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, Toast } from '../ui';
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

const DESKTOP_NAV = [
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
  useEffect(() => {
    if (loginTriggeredRef.current) return;
    if (isAuthLoading) return;
    if (isAuthenticated) return;

    if (isDev && localStorage.getItem(DEV_SKIP_KEY) === 'true') return;

    const initData = getTelegramInitData();
    if (initData) {
      loginTriggeredRef.current = true;
      login(initData).catch(() => {});
    } else if (isDev) {
      setInitDataMissing(true);
    } else {
      setInitDataMissing(true);
    }
  }, [isAuthLoading, isAuthenticated, login, isDev]);

  // ── Dashboard ──────────────────────────────────────────────────────
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-sm text-white/50">Авторизация...</p>
        </div>
      </main>
    );
  }

  // ── Render: error ────────────────────────────────────────────────────
  if (authError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-4 rounded-xl bg-rose-500/10 p-5 ring-1 ring-rose-500/20">
          <h1 className="text-center text-sm font-bold text-rose-400">Ошибка авторизации</h1>
          <p className="text-center text-xs text-rose-400/80">{authError}</p>
          <div className="space-y-1.5 rounded-[10px] bg-white/[0.03] p-2.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-white/40">initData.length</span>
              <span className="font-mono text-white/60">{window.Telegram?.WebApp?.initData?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">userAgent</span>
              <span className="font-mono max-w-[60%] truncate text-white/60">{navigator.userAgent}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-[10px] bg-[#4C7DFF] px-4 py-2.5 text-xs font-semibold text-white active:scale-95"
          >
            Попробовать снова
          </button>
          <TelegramDebug />
        </div>
      </main>
    );
  }

  // ── Render: initData missing ────────────────────────────────────────
  if (initDataMissing && !isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-4 rounded-xl bg-rose-500/10 p-5 ring-1 ring-rose-500/20">
          <h1 className="text-center text-sm font-bold text-rose-400">Ошибка запуска приложения</h1>
          <p className="text-center text-xs text-rose-400/80">Приложение должно быть открыто через Telegram Mini App</p>
          <div className="space-y-1.5 rounded-[10px] bg-white/[0.03] p-2.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-white/40">initData</span>
              <span className="font-mono text-rose-400">отсутствует</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">initData.length</span>
              <span className="font-mono text-white/60">0</span>
            </div>
          </div>
          <TelegramDebug />
          {isDev && (
            <div className="space-y-2.5 rounded-[10px] bg-blue-500/10 p-3.5">
              <p className="text-center text-xs font-medium text-blue-400">🔧 Dev-режим: вставьте initData или пропустите</p>
              <textarea
                value={devInitInput}
                onChange={(e) => setDevInitInput(e.target.value)}
                placeholder="Вставьте initData..."
                rows={2}
                className="w-full rounded-[8px] border border-white/10 bg-white/[0.03] p-2 text-[10px] font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#4C7DFF]/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDevInitSubmit}
                  className="flex-1 rounded-[10px] bg-[#4C7DFF] px-4 py-2 text-xs font-semibold text-white active:scale-95"
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={handleDevSkip}
                  className="flex-1 rounded-[10px] bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/60 ring-1 ring-white/10 active:scale-95"
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-sm text-white/50">Загрузка...</p>
        </div>
      </main>
    );
  }

  const dashboard = dashboardQuery.data;
  const unread = dashboard.notifications.filter((item) => !item.isRead).length;
  const pendingRequests =
    dashboard.requests.filter((request) => request.status === 'PENDING').length +
    (dashboard.vacations ?? []).filter((request) => request.status === 'PENDING').length;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col safe-area">
      {/* ═══ Top Bar (compact) ═══ */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.04] px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-white/90">QA TimeOff</span>
          <div className="hidden items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-white/50">Детский мир</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { hapticSelection(); navigate('/notifications'); }}
            className="relative grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
            aria-label="Уведомления"
          >
            <Bell size={16} />
            {!!unread && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/40" />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-[10px] font-bold text-white"
          >
            EK
          </button>
        </div>
      </header>

      {/* ═══ Desktop sidebar + content ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop side nav */}
        <nav className="hidden w-[56px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.04] py-3 lg:flex">
          {DESKTOP_NAV.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => { hapticSelection(); navigate(item.to); }}
              className={`relative grid h-10 w-10 place-items-center rounded-xl text-xs transition-colors ${
                isActive(item.to)
                  ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]'
                  : 'text-white/30 hover:bg-white/[0.04] hover:text-white/60'
              }`}
              title={item.label}
            >
              <item.icon size={18} />
            </button>
          ))}
        </nav>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          {children}
        </main>
      </div>

      {/* Floating Action Button (mobile) */}
      <NavLink
        to="/timeoff/new"
        onClick={() => hapticSelection()}
        className="fixed bottom-[calc(4rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] right-5 z-20 grid h-10 w-10 place-items-center rounded-xl app-gradient text-white shadow-lg shadow-blue-500/30 animate-pulse-glow lg:hidden"
      >
        <Plus size={18} />
      </NavLink>

      {/* Bottom Navigation (mobile) */}
      <BottomNavigation
        items={navItems.map((item) => ({
          ...item,
          active: isActive(item.to),
          badge: item.to === '/requests' ? pendingRequests : undefined,
          onClick: () => {
            hapticSelection();
            navigate(item.to);
          },
        }))}
      />

      {/* Admin button (mobile) */}
      {dashboard.user.role === 'ADMIN' && (
        <NavLink
          to="/admin"
          onClick={() => hapticSelection()}
          className="fixed bottom-[calc(4rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] left-5 z-20 grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] text-white/50 shadow-lg lg:hidden"
        >
          <Shield size={18} />
        </NavLink>
      )}

      {toast && <Toast title={toast.title} message={toast.message} tone={toast.tone} />}
    </div>
  );
}

// --- Dev mode placeholder page ---
export function DevPlaceholder() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
      <div className="w-full space-y-5 rounded-xl bg-blue-500/10 p-6 ring-1 ring-blue-500/20">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[14px] bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-white shadow-lg">
          <Bug size={28} />
        </div>
        <div className="text-center">
          <h1 className="text-base font-bold text-white">🔧 Dev-режим</h1>
          <p className="mt-1.5 text-xs font-medium text-white/50">
            Приложение открыто вне Telegram Mini App.
          </p>
        </div>
        <div className="rounded-[10px] bg-white/[0.03] p-3 text-[10px]">
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
          className="w-full rounded-[10px] bg-[#4C7DFF] px-4 py-2.5 text-xs font-semibold text-white active:scale-95"
        >
          Сбросить dev-режим
        </button>
      </div>
    </main>
  );
}
