import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Clock,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Shield,
  Timer,
  Upload,
  Users,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { SearchModal, Toast } from '../ui';
import { useAuth } from '../../shared/auth/AuthContext';
import { useSseNotifications } from '../../shared/hooks/useSseNotifications';
import { useDashboard } from '../../shared/hooks/useDashboard';

type NavChild = {
  label: string;
  to: string;
  icon: React.ElementType;
  roles?: string[];
};

type NavSection = {
  label: string;
  icon: React.ElementType;
  to?: string;
  children?: NavChild[];
  roles?: string[];
};

const sidebarSections: NavSection[] = [
  {
    label: 'Обзор',
    icon: LayoutDashboard,
    children: [
      { label: 'Дашборд', to: '/', icon: LayoutDashboard, roles: ['ALL'] },
    ],
  },
  {
    label: 'Заявки',
    icon: ClipboardList,
    children: [
      { label: 'Мои заявки', to: '/requests/my', icon: FileText, roles: ['ALL'] },
      { label: 'Заявки команды', to: '/requests/team', icon: Users, roles: ['LEAD', 'MANAGER', 'ADMIN'] },
      { label: 'Календарь', to: '/calendar', icon: CalendarDays, roles: ['ALL'] },
    ],
  },
  {
    label: 'Баланс',
    icon: Clock,
    children: [
      { label: 'Мой баланс', to: '/balance', icon: WalletCards, roles: ['ALL'] },
      { label: 'Балансы сотрудников', to: '/balance/employees', icon: Users, roles: ['MANAGER', 'ADMIN'] },
    ],
  },
  {
    label: 'Тайм-трекинг',
    icon: Timer,
    children: [
      { label: 'Таймшит', to: '/timetracking', icon: Timer, roles: ['ALL'] },
      { label: 'Календарь списаний', to: '/timetracking/calendar', icon: CalendarDays, roles: ['ALL'] },
      { label: 'Отчёты', to: '/timetracking/reports', icon: BarChart3, roles: ['LEAD', 'MANAGER', 'ADMIN'] },
    ],
  },
  {
    label: 'Аналитика',
    icon: BarChart3,
    roles: ['LEAD', 'MANAGER', 'ADMIN'],
    children: [
      { label: 'Нагрузка', to: '/analytics/workload', icon: Activity, roles: ['LEAD', 'MANAGER', 'ADMIN'] },
      { label: 'Отчёты', to: '/analytics', icon: BarChart3, roles: ['LEAD', 'MANAGER', 'ADMIN'] },
    ],
  },
  {
    label: 'Организация',
    icon: Users,
    roles: ['MANAGER', 'ADMIN'],
    children: [
      { label: 'Сотрудники', to: '/employees', icon: Users, roles: ['MANAGER', 'ADMIN'] },
      { label: 'Команды', to: '/teams', icon: Users, roles: ['MANAGER', 'ADMIN'] },
      { label: 'Настройки организации', to: '/settings/organization', icon: Settings, roles: ['MANAGER', 'ADMIN'] },
      { label: 'Интеграция с Jira', to: '/settings/integrations/jira', icon: Settings, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Администрирование',
    icon: Shield,
    roles: ['ADMIN'],
    children: [
      { label: 'Пользователи', to: '/admin/users', icon: Users, roles: ['ADMIN'] },
      { label: 'Роли', to: '/settings/roles', icon: Shield, roles: ['ADMIN'] },
      { label: 'Импорт', to: '/import', icon: Upload, roles: ['ADMIN'] },
      { label: 'Журналы', to: '/audit-log', icon: Activity, roles: ['ADMIN'] },
    ],
  },
];

const breadcrumbs: Record<string, string> = {
  '/': 'Дашборд',
  '/dashboard': 'Дашборд',
  '/requests': 'Заявки',
  '/requests/my': 'Мои заявки',
  '/requests/manager': 'Заявки команды',
  '/requests/team': 'Заявки команды',
  '/requests/approvals': 'Согласование',
  '/calendar': 'Календарь',
  '/balance': 'Мой баланс',
  '/balance/employees': 'Балансы сотрудников',
  '/teams': 'Команды',
  '/employees': 'Сотрудники',
  '/users': 'Пользователи',
  '/analytics': 'Отчёты',
  '/analytics/workload': 'Нагрузка',
  '/admin': 'Администрирование',
  '/admin/users': 'Пользователи',
  '/notifications': 'Уведомления',
  '/profile': 'Профиль',
  '/timeoff/new': 'Новый отгул',
  '/vacation/new': 'Новый отпуск',
  '/team': 'Команда',
  '/settings/organization': 'Настройки организации',
  '/settings/roles': 'Управление ролями',
  '/settings': 'Настройки',
  '/import': 'Импорт',
  '/audit-log': 'Журналы',
  '/invites': 'Приглашения',
};

function getBreadcrumb(path: string) {
  for (const [key, label] of Object.entries(breadcrumbs)) {
    if (path === key || (key !== '/' && path.startsWith(key))) return label;
  }
  return '';
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading, authError, user, logout, mustChangePassword } = useAuth();
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: 'success' | 'error' | 'info' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Обзор', 'Заявки']));
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

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
    if (isAuthenticated && mustChangePassword && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
      return;
    }
    if (!isAuthenticated && !isAuthLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, mustChangePassword, location.pathname, navigate]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useSseNotifications();

  const { dashboard: d, isLoading: isDashboardLoading } = useDashboard();

  const currentBreadcrumb = useMemo(() => getBreadcrumb(location.pathname), [location.pathname]);

  if (isAuthLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-sm text-white/50">Авторизация...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) return null;

  const accessDenied = authError?.includes('не найден') || authError?.includes('заблокирован') || authError?.includes('not found') || authError?.includes('inactive');

  if (accessDenied) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5 rounded-xl bg-rose-950/300/10 p-6 ring-1 ring-rose-500/20">
          <h1 className="text-lg font-bold text-rose-400">Доступ запрещён</h1>
          <p className="text-sm text-rose-300/80">{authError}</p>
          <button onClick={() => window.location.reload()} className="w-full rounded-lg bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/60 ring-1 ring-white/10">
            Попробовать снова
          </button>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl bg-rose-950/300/10 p-5 ring-1 ring-rose-500/20">
          <h1 className="text-lg font-bold text-rose-400">Ошибка авторизации</h1>
          <p className="text-sm text-rose-400/80">{authError}</p>
          <button onClick={() => { localStorage.removeItem('qa-timeoff-token'); window.location.reload(); }} className="w-full rounded-lg bg-[#4C7DFF] px-4 py-3 text-sm font-semibold text-white">
            На страницу входа
          </button>
        </div>
      </main>
    );
  }

  if (isDashboardLoading && !d.user.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-[#4C7DFF]" />
          <p className="text-sm text-white/50">Загрузка...</p>
        </div>
      </main>
    );
  }

  const unread = d.notifications.filter((n) => !n.isRead).length;
  const pendReq = d.requests.filter((r) => r.status === 'PENDING').length + (d.vacations ?? []).filter((v) => v.status === 'PENDING').length;
  const currentUser = user ?? d.user;
  const initials = currentUser.fullName?.slice(0, 2).toUpperCase() || 'QA';

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className={clsx('hidden shrink-0 flex-col border-r border-white/[0.06] bg-[#0B1220] transition-all lg:flex', collapsed ? 'w-[60px]' : 'w-[232px]')}>
        <div className={clsx('flex h-14 items-center border-b border-white/[0.06]', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg app-gradient text-[14px] font-bold text-white">QT</div>
          {!collapsed && <span className="text-[15px] font-bold text-white truncate">QA TimeOff</span>}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={clsx('shrink-0 grid h-6 w-6 place-items-center rounded text-white/30 hover:text-white/70', collapsed ? 'mx-auto mt-2' : 'ml-auto')}
          >
            <ChevronLeft size={14} className={clsx('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {sidebarSections
            .filter(section => {
              if (!section.roles) return true;
              return section.roles.includes('ALL') || section.roles.includes(d.user.role);
            })
            .map((section) => (
            <div key={section.label} className="mb-1">
              {section.children ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className={clsx('flex w-full items-center gap-2 px-3 py-1.5 text-[14px] font-bold uppercase tracking-widest text-white/25 hover:text-white/40 transition-colors', collapsed && 'justify-center px-0')}
                  >
                    {collapsed ? <section.icon size={14} /> : <><section.icon size={12} />{section.label}<ChevronDown size={10} className={clsx('ml-auto transition-transform', expandedSections.has(section.label) && 'rotate-180')} /></>}
                  </button>
                  {expandedSections.has(section.label) && section.children
                    .filter(child => {
                      if (!child.roles) return true;
                      return child.roles.includes('ALL') || child.roles.includes(d.user.role);
                    })
                    .map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.to === '/'}
                      className={({ isActive }) =>
                        clsx('flex items-center gap-3 rounded-lg mx-2 px-3 py-2 text-[15px] font-semibold transition-colors', collapsed && 'mx-1 justify-center px-2',
                          isActive ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-[#7A8599] hover:bg-white/[0.04] hover:text-[#B8C0D0]')
                      }
                      title={collapsed ? child.label : undefined}
                    >
                      <child.icon size={18} />
                      {!collapsed && child.label}
                      {!collapsed && child.to === '/requests/my' && pendReq > 0 && (
                        <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-amber-500/20 text-[14px] font-bold text-amber-400">{pendReq > 9 ? '9+' : pendReq}</span>
                      )}
                    </NavLink>
                  ))}
                </>
              ) : (
                <NavLink
                  to={section.to || '/'}
                  end
                  className={({ isActive }) =>
                    clsx('flex items-center gap-3 rounded-lg mx-2 px-3 py-2 text-[15px] font-semibold transition-colors', collapsed && 'mx-1 justify-center px-2',
                      isActive ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-[#7A8599] hover:bg-white/[0.04] hover:text-[#B8C0D0]')
                  }
                >
                  <section.icon size={18} />
                  {!collapsed && section.label}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        <span className="px-3 py-3 text-[12px] text-white/15">QA TimeOff v1</span>
      </aside>

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0B1220]/80 px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-white lg:hidden">
              <LayoutDashboard size={18} />
            </button>
            {currentBreadcrumb && (
              <div className="hidden items-center gap-1.5 text-sm lg:flex">
                <span className="text-white/30">/</span>
                <span className="font-medium text-white/70">{currentBreadcrumb}</span>
              </div>
            )}
            <span className="text-[15px] font-bold text-white lg:hidden">QA TimeOff</span>
          </div>

          <div className="flex items-center gap-3 flex-1 max-w-md mx-4">
            <div className="relative w-full hidden lg:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Поиск..."
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pl-9 pr-3 text-[15px] text-white placeholder:text-white/20 outline-none focus:border-[#4C7DFF]/30 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSearchOpen(true)} className="hidden lg:grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-white" title="Поиск (Ctrl+K)">
              <Search size={17} />
            </button>
            <button type="button" onClick={() => navigate('/notifications')} className="relative grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-white">
              <Bell size={17} />
              {!!unread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-950/300 shadow-lg shadow-rose-500/40" />}
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-white">
              <HelpCircle size={17} />
            </button>
            <button type="button" onClick={() => navigate('/profile')} className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-[15px] font-bold text-white" title={currentUser.fullName}>
              {initials}
            </button>
            <button type="button" onClick={() => { logout(); navigate('/login'); }} className="grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-rose-400" title="Выйти">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="flex h-full w-60 flex-col bg-[#0B1220] p-4" onClick={(e) => e.stopPropagation()}>
              <nav className="flex-1 space-y-3">
                {sidebarSections
                  .filter(section => {
                    if (!section.roles) return true;
                    return section.roles.includes('ALL') || section.roles.includes(d.user.role);
                  })
                  .map((section) => (
                  <div key={section.label}>
                    <div className="mb-1 px-3 text-[14px] font-bold uppercase tracking-widest text-white/25">{section.label}</div>
                    {section.children?.filter(child => {
                      if (!child.roles) return true;
                      return child.roles.includes('ALL') || child.roles.includes(d.user.role);
                    }).map((child) => (
                      <NavLink key={child.to} to={child.to} end={child.to === '/'} onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold',
                          isActive ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-[#7A8599] hover:bg-white/[0.04]')}>
                        <child.icon size={18} />{child.label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>
              <button type="button" onClick={() => { logout(); navigate('/login'); }} className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold text-rose-400 hover:bg-rose-950/300/20">
                <LogOut size={18} />Выйти
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>

      {toast && <Toast title={toast.title} message={toast.message} tone={toast.tone} />}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
