import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ClipboardList, Home, Plus, Shield, UserRound, WalletCards } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, Header } from '../ui';
import { api, setAccessToken } from '../../shared/api';
import { getTelegramInitData, setupTelegramApp } from '../../shared/utils/telegram';
import { mockDashboard } from '../../shared/api/mocks';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/balance', label: 'Balance', icon: WalletCards },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/requests', label: 'Requests', icon: ClipboardList },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [demoMode, setDemoMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setupTelegramApp();
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-28 pt-4 safe-area">
      <Header
        eyebrow="QA TimeOff"
        title={`Hello, ${dashboard.user.fullName.split(' ')[0]}`}
        subtitle={demoMode ? 'Demo mode' : undefined}
        action={
          <div className="relative grid h-12 w-12 place-items-center rounded-[20px] bg-white/75 text-slate-700 shadow-soft dark:bg-slate-900/70 dark:text-slate-200">
            <Bell size={21} />
            {!!unread && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-400" />}
          </div>
        }
      />

      <div className="grid gap-4">{children}</div>

      <NavLink
        to="/timeoff/new"
        className="fixed bottom-24 right-[calc(50%-17rem)] z-20 grid h-14 w-14 place-items-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-300/50 max-[600px]:right-5"
      >
        <Plus size={24} />
      </NavLink>

      <BottomNavigation
        items={navItems.map((item) => ({
          ...item,
          active: item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
          onClick: () => {
            navigate(item.to);
          },
        }))}
      />

      {dashboard.user.role === 'ADMIN' && (
        <NavLink
          to="/admin"
          className="fixed bottom-24 left-[calc(50%-17rem)] z-20 grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-slate-700 shadow-soft max-[600px]:left-5"
        >
          <Shield size={21} />
        </NavLink>
      )}
    </main>
  );
}
