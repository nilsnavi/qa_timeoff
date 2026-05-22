import { useQuery } from '@tanstack/react-query';
import { Bell, BellRing, LogOut, Mail, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, ErrorState, SkeletonCard } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { User } from '../shared/types';
import { confirmTelegram, getRoleLabel, showAppToast } from '../shared/utils';

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
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const profileQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.me,
    enabled: hasToken,
  });
  const user = profileQuery.data ?? dashboard.user;
  const storageKey = `qa-timeoff-notifications-${user.id}`;
  const [notifications, setNotifications] = useState<NotificationSettings>(() => readNotificationSettings(storageKey));
  const initials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  useEffect(() => {
    setNotifications(readNotificationSettings(storageKey));
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
  };

  const logout = async () => {
    if (!(await confirmTelegram('Выйти из профиля?', 'Текущая сессия будет сброшена на этом устройстве.'))) {
      return;
    }

    localStorage.removeItem('qa-timeoff-token');
    showAppToast('Вы вышли из профиля');
    window.location.assign('/');
  };

  if (profileQuery.isLoading && !profileQuery.data) {
    return <ProfileSkeleton />;
  }

  if (profileQuery.isError && !dashboard.user) {
    return <ErrorState title="Профиль не загрузился" description="Не удалось получить данные пользователя." onRetry={() => profileQuery.refetch()} />;
  }

  return (
    <>
      <Card className="overflow-hidden app-gradient text-white">
        <div className="flex items-center gap-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[32px] bg-white/20 text-3xl font-black shadow-lg shadow-blue-900/10 ring-1 ring-white/25">
            {initials || <UserRound size={34} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold opacity-80">Профиль</p>
            <h2 className="truncate text-2xl font-black">{user.fullName}</h2>
            <p className="mt-1 truncate text-sm font-bold opacity-85">{user.position || 'Должность не указана'}</p>
            <div className="mt-3">
              <span className="inline-flex min-h-8 items-center rounded-full bg-white/20 px-3 text-xs font-black ring-1 ring-white/20">
                {getRoleLabel(user.role)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Данные пользователя</h2>
          <ShieldCheck className="text-blue-500" size={22} />
        </div>
        <div className="grid gap-2 text-sm">
          <InfoRow label="ФИО" value={user.fullName} />
          <InfoRow label="Должность" value={user.position || 'Не указана'} />
          <InfoRow label="Команда" value={getTeamLabel(user)} />
          <InfoRow label="Руководитель" value={user.manager?.fullName || 'Не указан'} />
          <InfoRow label="Email" value={user.email || 'Не указан'} />
          <InfoRow label="Роль" value={getRoleLabel(user.role)} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Настройки</h2>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Уведомления сохраняются на этом устройстве</p>
          </div>
          <BellRing className="text-violet-500" size={22} />
        </div>
        <div className="grid gap-2">
          <NotificationToggle
            icon={Bell}
            title="Статусы заявок"
            description="Согласование, отклонение и отмена"
            checked={notifications.requestUpdates}
            onChange={() => toggleNotification('requestUpdates')}
          />
          <NotificationToggle
            icon={UsersRound}
            title="Заявки команды"
            description="Новые заявки на согласование"
            checked={notifications.teamRequests}
            onChange={() => toggleNotification('teamRequests')}
          />
          <NotificationToggle
            icon={Mail}
            title="Email-дайджест"
            description={user.email ? 'Сводка по заявкам на почту' : 'Добавьте email, чтобы получать дайджест'}
            checked={notifications.emailDigest}
            disabled={!user.email}
            onChange={() => toggleNotification('emailDigest')}
          />
        </div>
      </Card>

      <Button variant="danger" size="lg" onClick={logout}>
        <LogOut size={19} />
        Выйти
      </Button>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <SkeletonCard rows={2} />
      <SkeletonCard rows={5} />
      <SkeletonCard rows={4} />
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-white/60 px-3 py-2 dark:bg-slate-900/60">
      <span className="shrink-0 font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-right font-black text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}

function NotificationToggle({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-[20px] bg-white/65 p-3 dark:bg-slate-900/60 ${
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'
      }`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[18px] ${checked ? 'app-gradient text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-slate-900 dark:text-white">{title}</span>
        <span className="block text-sm font-bold text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="relative h-7 w-12 rounded-full bg-slate-200 transition peer-checked:bg-blue-500 peer-disabled:bg-slate-200 dark:bg-slate-700">
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function readNotificationSettings(storageKey: string): NotificationSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return defaultNotificationSettings;
    }

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
