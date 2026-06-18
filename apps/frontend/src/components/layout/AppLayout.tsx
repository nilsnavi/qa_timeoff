import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ClipboardList, Home, Plus, Shield, UserRound, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, Header, Toast } from '../ui';
import { api, setAccessToken } from '../../shared/api';
import { cleanupTelegramApp, getTelegramInitData, hapticSelection, setupTelegramApp, useTelegramBackButton } from '../../shared/utils/telegram';
import { TelegramDebug } from '../TelegramDebug';

const navItems = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/balance', label: 'Баланс', icon: WalletCards },
  { to: '/requests', label: 'Заявки', icon: ClipboardList },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/profile', label: 'Профиль', icon: UserRound },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [initDataMissing, setInitDataMissing] = useState(false);
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: 'success' | 'error' | 'info' } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const handleBack = useCallback(() => navigate(-1), [navigate]);

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

  const authMutation = useMutation({
    mutationFn: async (initData: string) => {
      const authResult = await api.auth(initData);
      const token = authResult.accessToken ?? authResult.token;
      if (!token) {
        throw new Error('Токен авторизации не получен');
      }
      setAccessToken(token);
      // Verify user profile via /auth/me
      const profile = await api.me();
      if (!profile.id || !profile.telegramId) {
        throw new Error('Некорректные данные профиля');
      }
      return { authResult, profile };
    },
    onSuccess: () => {
      // Token already set, dashboard query will be enabled
    },
    onError: (error: Error) => {
      setAuthError(error.message || 'Ошибка авторизации');
    },
  });

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) {
      setInitDataMissing(true);
      return;
    }
    authMutation.mutate(initData);
  }, []);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  // --- Error screen: no initData from Telegram ---
  if (initDataMissing) {
    return (
      <main className="mx-auto flex min-h-[var(--tg-viewport-height)] w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
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
        </div>
      </main>
    );
  }

  // --- Error screen: auth failed ---
  if (authError) {
    return (
      <main className="mx-auto flex min-h-[var(--tg-viewport-height)] w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
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

  // --- Loading screen ---
  if (!dashboardQuery.data) {
    return (
      <main className="mx-auto flex min-h-[var(--tg-viewport-height)] w-full max-w-xl flex-col items-center justify-center px-4 py-8 safe-area">
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
            <div className="flex h-12 min-w-[124px] max-w-[150px] items-center justify-center rounded-[20px] bg-white/75 px-3 shadow-soft ring-1 ring-white/70 dark:bg-slate-900/70 dark:ring-slate-700">
              <img src="/dm-logo.svg" alt="Деловые Линии" className="max-h-7 w-full object-contain" />
            </div>
            <div className="relative grid h-12 w-12 place-items-center rounded-[20px] bg-white/75 text-slate-700 shadow-soft dark:bg-slate-900/70 dark:text-slate-200">
              <button
                type="button"
                aria-label="Уведомления"
                className="grid h-full w-full place-items-center rounded-[20px]"
                onClick={() => {
                  hapticSelection();
                  navigate('/notifications');
                }}
              >
                <Bell size={21} />
              </button>
              {!!unread && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-400" />}
            </div>
          </div>
        }
      />

      <div className="grid gap-4">{children}</div>

      <NavLink
        to="/timeoff/new"
        onClick={() => hapticSelection()}
        className="fixed bottom-[calc(6rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] right-[calc(50%-17rem)] z-20 grid h-14 w-14 place-items-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-300/50 max-[600px]:right-5"
      >
        <Plus size={24} />
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
