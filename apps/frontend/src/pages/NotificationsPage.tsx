import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, CheckCheck, CircleDot, FileCheck2, FilePlus2, FileX2, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonCard } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { NotificationItem } from '../shared/types';
import { showAppToast } from '../shared/utils';

type FilterValue = 'ALL' | 'UNREAD';

const filters: Array<{ value: FilterValue; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'UNREAD', label: 'Непрочитанные' },
];

export function NotificationsPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications,
    enabled: hasToken,
  });
  const notifications = notificationsQuery.data ?? dashboard.notifications ?? [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const filteredNotifications = useMemo(
    () => notifications.filter((item) => filter === 'ALL' || !item.isRead),
    [filter, notifications],
  );

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const markRead = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: invalidateNotifications,
    onError: () => showAppToast('Не удалось отметить уведомление', 'Попробуйте еще раз', 'error'),
  });

  const markAllRead = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      showAppToast('Все уведомления прочитаны');
      invalidateNotifications();
    },
    onError: () => showAppToast('Не удалось обновить уведомления', 'Попробуйте еще раз', 'error'),
  });

  if (notificationsQuery.isLoading && notifications.length === 0) {
    return <NotificationsSkeleton />;
  }

  if (notificationsQuery.isError && notifications.length === 0) {
    return (
      <ErrorState
        title="Уведомления не загрузились"
        description="Не удалось получить список уведомлений."
        onRetry={() => notificationsQuery.refetch()}
      />
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#7A8599]">Уведомления</p>
            <h2 className="text-xl font-black text-white">События</h2>
          </div>
          <Badge tone={unreadCount > 0 ? 'warning' : 'success'}>{unreadCount} новых</Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`min-h-10 rounded-[18px] px-4 text-sm font-black transition ${
                  filter === item.value
                    ? 'app-gradient text-white shadow-lg shadow-blue-500/20'
                    : 'bg-[#111A2E]/70 text-[#7A8599] ring-1 ring-white/[0.10] bg-[#111A2E]/70 text-[#7A8599] ring-white/[0.06]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" disabled={unreadCount === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            <CheckCheck size={17} />
            Отметить все
          </Button>
        </div>
      </Card>

      {filteredNotifications.length === 0 ? (
        <EmptyState title="Уведомлений нет" description={filter === 'UNREAD' ? 'Все уведомления уже прочитаны.' : 'Новые события появятся здесь.'} />
      ) : (
        <div className="grid gap-2">
          {filteredNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              disabled={markRead.isPending}
              onRead={() => markRead.mutate(notification.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function NotificationsSkeleton() {
  return (
    <>
      <SkeletonCard rows={2} />
      <SkeletonCard rows={2} />
      <SkeletonCard rows={2} />
    </>
  );
}

function NotificationCard({
  notification,
  disabled,
  onRead,
}: {
  notification: NotificationItem;
  disabled: boolean;
  onRead: () => void;
}) {
  const Icon = getNotificationIcon(notification.type);

  return (
    <Card className={notification.isRead ? 'opacity-75' : ''}>
      <button
        type="button"
        disabled={notification.isRead || disabled}
        onClick={onRead}
        className="flex w-full items-start gap-3 text-left disabled:cursor-default"
      >
        <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-white ${getNotificationColor(notification.type)}`}>
          <Icon size={20} />
          {!notification.isRead && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-950/300 ring-2 ring-white ring-slate-950" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="font-black text-white">{notification.title}</span>
            {!notification.isRead && <CircleDot className="mt-0.5 shrink-0 text-blue-500" size={16} />}
          </span>
          <span className="mt-1 block text-sm font-semibold text-[#7A8599]">{notification.message}</span>
          <span className="mt-2 block text-xs font-black text-[#7A8599]">{formatDateTime(notification.createdAt)}</span>
        </span>
      </button>
    </Card>
  );
}

function getNotificationIcon(type: string) {
  const normalized = type.toUpperCase();

  if (normalized.includes('APPROVED')) {
    return FileCheck2;
  }
  if (normalized.includes('REJECTED')) {
    return FileX2;
  }
  if (normalized.includes('BALANCE')) {
    return WalletCards;
  }
  if (normalized.includes('VACATION_REMINDER') || normalized.includes('REMINDER')) {
    return CalendarClock;
  }
  if (normalized.includes('REQUEST_CREATED') || normalized.includes('CREATED')) {
    return FilePlus2;
  }

  return Bell;
}

function getNotificationColor(type: string) {
  const normalized = type.toUpperCase();

  if (normalized.includes('APPROVED')) {
    return 'bg-emerald-500';
  }
  if (normalized.includes('REJECTED')) {
    return 'bg-rose-950/300';
  }
  if (normalized.includes('BALANCE')) {
    return 'bg-blue-600';
  }
  if (normalized.includes('VACATION_REMINDER') || normalized.includes('REMINDER')) {
    return 'bg-orange-500';
  }

  return 'bg-violet-500';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
