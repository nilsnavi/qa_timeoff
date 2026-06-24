import { useQuery } from '@tanstack/react-query';
import { Bell, Bug, CalendarDays, ClipboardList, Home, Lock, Plus, Shield, UserRound, WalletCards } from 'lucide-react';
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

  useEffect(() => {
    setupTelegramApp();
    return cleanupTelegramApp;
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const nextToast = (event as CustomEvent<typeof toast>).detail;
      setToast(nextToast);
      window.setTimeout(() => setToast(null), 2600);
    };

    window.addEventListener('qa-timeoff-toast', listener);
    return () => window.removeEventListener('qa-timeoff-toast', listener);
  }, []);

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

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

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

  if (isAuthLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-[14px] text-white/50">Авторизация...</p>
        </div>
      </main>
    );
  }

  const isAccessDenied = authError?.includes('не найден') || authError?.includes('заблокирован') || authError?.includes('not found') || authError?.includes('inactive');

  if (isAccessDenied) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-5 rounded-xl bg-rose-950/300/10 p-6 ring-1 ring-rose-500/20">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[14px] bg-rose-950/300/15 text-rose-400">
            <Lock size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-[16px] font-bold text-rose-400">Доступ запрещён</h1>
            <p className="mt-2 text-[14px] font-medium text-rose-300/80">
              {authError}
            </p>
            <p className="mt-4 text-[13px] font-medium text-white/30">
              Обратитесь к администратору для получения доступа.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-[10px] bg-white/[0.06] px-4 py-3 text-[14px] font-semibold text-white/60 ring-1 ring-white/10 active:scale-95"
          >
            Попробовать снова
          </button>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-4 rounded-xl bg-rose-950/300/10 p-5 ring-1 ring-rose-500/20">
          <h1 className="text-center text-[15px] font-bold text-rose-400">Ошибка авторизации</h1>
          <p className="text-center text-[13px] text-rose-400/80">{authError}</p>
          <div className="space-y-1.5 rounded-[10px] bg-white/[0.03] p-2.5 text-[11px]">
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
            className="w-full rounded-[10px] bg-[#4C7DFF] px-4 py-3 text-[14px] font-semibold text-white active:scale-95"
          >
            Попробовать снова
          </button>
          <TelegramDebug />
        </div>
      </main>
    );
  }

  if (initDataMissing && !isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="w-full space-y-4 rounded-xl bg-rose-950/300/10 p-5 ring-1 ring-rose-500/20">
          <h1 className="text-center text-[15px] font-bold text-rose-400">Ошибка запуска приложения</h1>
          <p className="text-center text-[13px] text-rose-400/80">Приложение должно быть открыто через Telegram Mini App</p>
          <div className="space-y-1.5 rounded-[10px] bg-white/[0.03] p-2.5 text-[11px]">
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
            <div className="space-y-2.5 rounded-[10px] bg-blue-900/400/10 p-3.5">
              <p className="text-center text-[13px] font-medium text-blue-400">Dev-режим: вставьте initData или пропустите</p>
              <textarea
                value={devInitInput}
                onChange={(e) => setDevInitInput(e.target.value)}
                placeholder="Вставьте initData..."
                rows={2}
                className="w-full rounded-[8px] border border-white/10 bg-white/[0.03] p-2 text-[11px] font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#4C7DFF]/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDevInitSubmit}
                  className="flex-1 rounded-[10px] bg-[#4C7DFF] px-4 py-3 text-[13px] font-semibold text-white active:scale-95"
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={handleDevSkip}
                  className="flex-1 rounded-[10px] bg-white/[0.06] px-4 py-3 text-[13px] font-semibold text-white/60 ring-1 ring-white/10 active:scale-95"
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

  const isDevSkip = isDev && localStorage.getItem(DEV_SKIP_KEY) === 'true';
  if (isDevSkip) {
    return <DevPlaceholder />;
  }

  if (!dashboardQuery.data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-4 py-8 safe-area">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-[14px] text-white/50">Загрузка...</p>
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      {/* Top Bar */}
      <header className="flex h-[52px] shrink-0 items-center justify-between px-4 safe-area">
        <div className="flex items-center gap-3">
          <span className="text-[16px] font-bold text-white">QA TimeOff</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { hapticSelection(); navigate('/notifications'); }}
            className="relative grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-[#B8C0D0] transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Уведомления"
          >
            <Bell size={17} />
            {!!unread && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-950/300 shadow-lg shadow-rose-500/40" />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-[11px] font-bold text-white"
          >
            {dashboard.user.fullName?.slice(0, 2).toUpperCase() || 'QA'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 pb-4 fab-spacing">
        {children}
      </main>

      {/* FAB */}
      <NavLink
        to="/timeoff/new"
        onClick={() => hapticSelection()}
        className="fixed bottom-[calc(4.5rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] right-4 z-20 grid h-12 w-12 place-items-center rounded-2xl app-gradient text-white shadow-lg shadow-blue-500/30 animate-pulse-glow"
      >
        <Plus size={20} />
      </NavLink>

      {/* Bottom Navigation */}
      <BottomNavigation
        items={navItems.map((item) => ({
          ...item,
          active: location.pathname === '/' ? item.to === '/' : location.pathname.startsWith(item.to),
          badge: item.to === '/requests' ? pendingRequests : undefined,
          onClick: () => {
            hapticSelection();
            navigate(item.to);
          },
        }))}
      />

      {/* Admin button */}
      {dashboard.user.role === 'ADMIN' && (
        <NavLink
          to="/admin"
          onClick={() => hapticSelection()}
          className="fixed bottom-[calc(4.5rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] left-4 z-20 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-[#B8C0D0] shadow-lg"
        >
          <Shield size={18} />
        </NavLink>
      )}

      {toast && <Toast title={toast.title} message={toast.message} tone={toast.tone} />}
    </div>
  );
}

export function DevPlaceholder() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-4 py-8 safe-area">
      <div className="w-full space-y-5 rounded-xl bg-blue-900/400/10 p-6 ring-1 ring-blue-500/20">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[14px] bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-white shadow-lg">
          <Bug size={28} />
        </div>
        <div className="text-center">
          <h1 className="text-[16px] font-bold text-white">Dev-режим</h1>
          <p className="mt-1.5 text-[14px] font-medium text-white/50">
            Приложение открыто вне Telegram Mini App.
          </p>
        </div>
        <div className="rounded-[10px] bg-white/[0.03] p-3 text-[11px]">
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
          className="w-full rounded-[10px] bg-[#4C7DFF] px-4 py-3 text-[14px] font-semibold text-white active:scale-95"
        >
          Сбросить dev-режим
        </button>
      </div>
    </main>
  );
}
