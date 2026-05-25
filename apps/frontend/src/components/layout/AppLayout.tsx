import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ClipboardList, Home, Plus, Shield, UserRound, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, Header, Toast } from '../ui';
import { api, setAccessToken } from '../../shared/api';
import { mockDashboard } from '../../shared/api/mocks';
import { cleanupTelegramApp, getTelegramInitData, hapticSelection, setupTelegramApp, useTelegramBackButton } from '../../shared/utils/telegram';

const navItems = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/balance', label: 'Баланс', icon: WalletCards },
  { to: '/requests', label: 'Заявки', icon: ClipboardList },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/profile', label: 'Профиль', icon: UserRound },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [demoMode, setDemoMode] = useState(false);
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
    mutationFn: api.auth,
    onSuccess: ({ accessToken, token }) => setAccessToken(accessToken ?? token),
    onError: () => setDemoMode(true),
  });

  useEffect(() => {
    const initData = getTelegramInitData();
    if (initData) {
      authMutation.mutate(initData);
    } else {
      setDemoMode(true);
    }
  }, []);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: !demoMode && !!localStorage.getItem('qa-timeoff-token'),
  });

  const dashboard = dashboardQuery.data ?? mockDashboard;
  const unread = dashboard.notifications.filter((item) => !item.isRead).length;
  const pendingRequests =
    dashboard.requests.filter((request) => request.status === 'PENDING').length +
    (dashboard.vacations ?? []).filter((request) => request.status === 'PENDING').length;

  return (
    <main className="mx-auto flex min-h-[var(--tg-viewport-height)] w-full max-w-xl flex-col px-4 pb-28 pt-4 safe-area">
      <Header
        eyebrow="QA TimeOff"
        title={`Привет, ${dashboard.user.fullName.split(' ')[0]}`}
        subtitle={demoMode ? 'Демо-режим' : undefined}
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
