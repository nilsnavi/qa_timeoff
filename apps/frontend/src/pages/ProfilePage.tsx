import { useQuery } from '@tanstack/react-query';
import { Bell, BellRing, Clock3, LogOut, Mail, Plane, Plus, ShieldCheck, UserRound, UsersRound, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, ErrorState, Loader } from '../components/ui';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { User } from '../shared/types';
import { getRoleLabel, hapticImpact, showAppToast } from '../shared/utils';

type NotificationSettings = {
  requestUpdates: boolean;
  teamRequests: boolean;
  emailDigest: boolean;
};

const defaultNotificationSettings: NotificationSettings = {
  requestUpdates: true,
  teamRequests: true,
  emailDigest: false,
};

export function ProfilePage() {
  const { dashboard } = useDashboard();
  const { clearAuth } = useAuth();
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const profileQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.me,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
  });
  const user = profileQuery.data ?? dashboard.user;
  const storageKey = `qa-timeoff-notifications-${user.id}`;
  const [notifications, setNotifications] = useState<NotificationSettings>(() => readNotificationSettings(storageKey));
  const initials = useMemo(() => getInitials(user.fullName), [user.fullName]);
  const balance = dashboard.balance;

  const pendingCount =
    dashboard.requests.filter((r) => r.status === 'PENDING').length +
    (dashboard.vacations ?? []).filter((v) => v.status === 'PENDING').length;

  const approvedCount =
    dashboard.requests.filter((r) => r.status === 'APPROVED').length +
    (dashboard.vacations ?? []).filter((v) => v.status === 'APPROVED').length;

  useEffect(() => {
    setNotifications(readNotificationSettings(storageKey));
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  const toggleNotification = (key: keyof NotificationSettings) => {
    hapticImpact('light');
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleLogout = async () => {
    if (!window.confirm('Выйти из профиля? Текущая сессия будет сброшена на этом устройстве.')) {
      return;
    }
    clearAuth();
    showAppToast('Вы вышли из профиля');
  };

  if (profileQuery.isLoading && !profileQuery.data && !dashboard.user.id) {
    return <Loader label="Загрузка профиля" />;
  }

  if (profileQuery.isError && !dashboard.user.id) {
    return <ErrorState title="Профиль не загрузился" description="Не удалось получить данные пользователя." onRetry={() => profileQuery.refetch()} />;
  }

  return (
    <div className="mb-24 flex flex-col gap-4">
      {/* 1. Profile Header */}
      <div className="overflow-hidden rounded-[18px] app-gradient">
        <div className="px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[20px] bg-white/20 text-[24px] font-black text-white shadow-inner">
              {initials || <UserRound size={30} className="text-white/70" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[18px] font-bold text-white text-wrap">{user.fullName}</h1>
              <p className="mt-0.5 text-[13px] font-medium text-white/60">
                {user.position || 'Должность не указана'}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-white/40">
                {user.team?.name || user.teamId || 'Без команды'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-md bg-white/20 px-2 text-[10px] font-bold text-white">
                  {getRoleLabel(user.role)}
                </span>
                <span className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-bold ${
                  user.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-950/300/15 text-rose-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {user.isActive ? 'Активен' : 'Заблокирован'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={Wallet} label="Доступно" value={`${balance.balanceHours} ч`} color="emerald" />
        <KpiCard icon={Clock3} label="Использовано" value={`${balance.totalUsedHours} ч`} color="blue" />
        <KpiCard icon={Plus} label="Начислено" value={`${balance.totalAddedHours} ч`} color="violet" />
        <KpiCard icon={Plane} label="Заявок" value={`${approvedCount} / ${pendingCount}`} color="amber" />
      </div>

      {/* 3. User Data */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-white">Данные</h2>
          <ShieldCheck className="text-[#4C7DFF]" size={18} />
        </div>
        <div className="grid gap-1">
          <InfoRow label="ФИО" value={user.fullName} />
          <InfoRow label="Должность" value={user.position || 'Не указана'} />
          <InfoRow label="Команда" value={getTeamLabel(user)} />
          <InfoRow label="Руководитель" value={user.manager?.fullName || 'Не указан'} />
          <InfoRow label="Email" value={user.email || 'Не указан'} />
          <InfoRow label="Роль" value={getRoleLabel(user.role)} />
        </div>
      </Card>

      {/* 4. Settings */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-white">Настройки</h2>
            <p className="text-[11px] font-medium text-[#7A8599]">Сохраняются локально</p>
          </div>
          <BellRing className="text-violet-400" size={18} />
        </div>
        <div className="grid gap-1.5">
          <ToggleRow
            icon={Bell}
            title="Статусы заявок"
            subtitle="Согласование, отклонение, отмена"
            checked={notifications.requestUpdates}
            onChange={() => toggleNotification('requestUpdates')}
          />
          <ToggleRow
            icon={UsersRound}
            title="Заявки команды"
            subtitle="Новые заявки на согласование"
            checked={notifications.teamRequests}
            onChange={() => toggleNotification('teamRequests')}
          />
          <ToggleRow
            icon={Mail}
            title="Email-дайджест"
            subtitle={user.email ? 'Сводка по заявкам на почту' : 'Добавьте email в профиль'}
            checked={notifications.emailDigest}
            disabled={!user.email}
            onChange={() => toggleNotification('emailDigest')}
          />
        </div>
      </Card>

      {/* 5. Destructive Actions */}
      <Button variant="danger" size="lg" onClick={handleLogout}>
        <LogOut size={18} />
        Выйти
      </Button>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Wallet; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    blue: 'bg-blue-900/400/15 text-blue-400',
    violet: 'bg-violet-500/15 text-violet-400',
    amber: 'bg-amber-500/15 text-amber-400',
  };

  return (
    <div className="enterprise-card flex flex-col gap-2 p-3.5 min-h-[76px]">
      <div className={`grid h-8 w-8 place-items-center rounded-[10px] ${colorMap[color] ?? 'bg-white/[0.06] text-white/40'}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[16px] font-bold text-white">{value}</p>
        <p className="text-[11px] font-medium text-[#7A8599]">{label}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5">
      <span className="shrink-0 text-[13px] font-medium text-[#7A8599]">{label}</span>
      <span className="text-right text-[13px] font-semibold text-white text-wrap">{value}</span>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  subtitle,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`flex items-center gap-3 rounded-[12px] p-3 transition ${
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-white/[0.03]'
    }`}>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${
        checked ? 'app-gradient text-white' : 'bg-white/[0.06] text-[#7A8599]'
      }`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-white">{title}</p>
        <p className="text-[11px] font-medium text-[#7A8599]">{subtitle}</p>
      </div>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={onChange} />
      <div className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[#4C7DFF]' : 'bg-white/[0.12]'
      } ${disabled ? 'opacity-50' : ''}`}>
        <div className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[23px]' : 'translate-x-[3px]'
        }`} />
      </div>
    </label>
  );
}

function readNotificationSettings(storageKey: string): NotificationSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultNotificationSettings;
    return { ...defaultNotificationSettings, ...JSON.parse(raw) };
  } catch {
    return defaultNotificationSettings;
  }
}

function getTeamLabel(user: User) {
  return user.team?.name || user.teamId || 'Не указана';
}

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
