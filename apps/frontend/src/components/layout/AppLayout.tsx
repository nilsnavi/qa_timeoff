import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Shield,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Toast } from '../ui';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';

const sidebarItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/requests', label: 'Requests', icon: ClipboardList },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/balance', label: 'Balance', icon: WalletCards },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/users', label: 'Users', icon: UserRound },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading, authError, user, logout } = useAuth();
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: 'success' | 'error' | 'info' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
    if (isAuthLoading) return;
    if (isAuthenticated) return;
    navigate('/login', { replace: true });
  }, [isAuthLoading, isAuthenticated, navigate]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  if (isAuthLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-[14px] text-white/50">Авторизация...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isAccessDenied = authError?.includes('не найден') || authError?.includes('заблокирован') || authError?.includes('not found') || authError?.includes('inactive');

  if (isAccessDenied) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-5 rounded-xl bg-rose-950/300/10 p-6 ring-1 ring-rose-500/20">
          <div className="text-center">
            <h1 className="text-[16px] font-bold text-rose-400">Доступ запрещён</h1>
            <p className="mt-2 text-[14px] font-medium text-rose-300/80">{authError}</p>
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
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-4 rounded-xl bg-rose-950/300/10 p-5 ring-1 ring-rose-500/20">
          <h1 className="text-center text-[15px] font-bold text-rose-400">Ошибка авторизации</h1>
          <p className="text-center text-[13px] text-rose-400/80">{authError}</p>
          <button
            type="button"
            onClick={() => { localStorage.removeItem('qa-timeoff-token'); window.location.reload(); }}
            className="w-full rounded-[10px] bg-[#4C7DFF] px-4 py-3 text-[14px] font-semibold text-white active:scale-95"
          >
            На страницу входа
          </button>
        </div>
      </main>
    );
  }

  if (!dashboardQuery.data) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
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
  const currentUser = user ?? dashboard.user;
  const initials = currentUser.fullName?.slice(0, 2).toUpperCase() || 'QA';

  return (
    <div className="flex min-h-dvh">
      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#0B1220] lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-white/[0.06] px-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg app-gradient text-[10px] font-bold text-white">
            QT
          </div>
          <span className="text-[15px] font-bold text-white">QA TimeOff</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors',
                  isActive
                    ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]'
                    : 'text-[#7A8599] hover:bg-white/[0.04] hover:text-[#B8C0D0]',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
              {item.to === '/requests' && pendingRequests > 0 && (
                <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-rose-950/300 text-[10px] font-bold text-white">
                  {pendingRequests > 9 ? '9+' : pendingRequests}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] px-3 py-3">
          {dashboard.user.role === 'ADMIN' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors',
                  isActive
                    ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]'
                    : 'text-[#7A8599] hover:bg-white/[0.04] hover:text-[#B8C0D0]',
                )
              }
            >
              <Shield size={18} />
              Admin
            </NavLink>
          )}
        </div>
      </aside>

      {/* ── Main Area ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0B1220]/80 px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="Toggle menu"
            >
              <LayoutDashboard size={18} />
            </button>
            <span className="text-[15px] font-bold text-white lg:hidden">QA TimeOff</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Notifications"
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
              title={currentUser.fullName}
            >
              {initials}
            </button>

            <button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] transition-colors hover:bg-white/[0.06] hover:text-rose-400"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* ── Mobile sidebar overlay ────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="flex h-full w-60 flex-col bg-[#0B1220] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="flex-1 space-y-1">
                {sidebarItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors',
                        isActive
                          ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]'
                          : 'text-[#7A8599] hover:bg-white/[0.04] hover:text-[#B8C0D0]',
                      )
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
                {dashboard.user.role === 'ADMIN' && (
                  <NavLink
                    to="/admin"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors',
                        isActive
                          ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]'
                          : 'text-[#7A8599] hover:bg-white/[0.04] hover:text-[#B8C0D0]',
                      )
                    }
                  >
                    <Shield size={18} />
                    Admin
                  </NavLink>
                )}
              </nav>
            </div>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>

      {toast && <Toast title={toast.title} message={toast.message} tone={toast.tone} />}
    </div>
  );
}
