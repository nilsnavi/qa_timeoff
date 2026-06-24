import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bell, ChevronLeft, ChevronRight, Clock, Plane, Plus, Stethoscope, Sun, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, Input, Select, Skeleton, Textarea } from '../../components/ui';
import { api } from '../../shared/api';
import { hapticSelection, showAppToast } from '../../shared/utils';
import type { CalendarEventEntry, CalendarEventType, Team } from '../../shared/types';
import { useDashboard } from '../../shared/hooks/useDashboard';

type CalendarFilter = 'ALL' | 'VACATION' | 'TIME_OFF' | 'SICK_LEAVE' | 'HOLIDAY';

const FILTER_LABELS: Record<CalendarFilter, string> = {
  ALL: 'Все типы',
  VACATION: 'Отпуск',
  TIME_OFF: 'Отгул',
  SICK_LEAVE: 'Больничный',
  HOLIDAY: 'Праздник',
};

const TYPE_COLORS: Record<string, string> = {
  VACATION: '#22C55E',
  TIME_OFF: '#3B82F6',
  SICK_LEAVE: '#8B5CF6',
  HOLIDAY: '#F97316',
};

const TYPE_ICONS: Record<string, typeof Plane> = {
  VACATION: Plane,
  TIME_OFF: Clock,
  SICK_LEAVE: Stethoscope,
  HOLIDAY: Sun,
};

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function CalendarEventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const currentUser = dashboard.user;
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState<CalendarFilter>('ALL');
  const [teamId, setTeamId] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isManager = currentUser.role === 'LEAD' || currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN';
  const isAdmin = currentUser.role === 'ADMIN';
  const monthStr = format(cursorDate, 'yyyy-MM');

  const params = useMemo(() => {
    const p: Record<string, string> = { month: monthStr };
    if (teamId !== 'ALL') p.team_id = teamId;
    if (typeFilter !== 'ALL') p.type = typeFilter;
    return p;
  }, [monthStr, teamId, typeFilter]);

  const eventsQuery = useQuery({
    queryKey: ['calendar-events', params],
    queryFn: () => api.calendarEvents(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: api.teams,
    staleTime: 10 * 60 * 1000,
  });

  const events = useMemo(() => eventsQuery.data?.items ?? [], [eventsQuery.data]);
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  const visibleDays = useMemo(() => {
    const monthStart = startOfMonth(cursorDate);
    const monthEnd = endOfMonth(cursorDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [cursorDate]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventEntry[]>();
    for (const event of events) {
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate);
      let current = start;
      while (current <= end) {
        const key = format(current, 'yyyy-MM-dd');
        const existing = map.get(key) ?? [];
        existing.push(event);
        map.set(key, existing);
        current = new Date(current.getTime() + 86400000);
      }
    }
    return map;
  }, [events]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayEvents = eventsByDate.get(todayStr) ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events', params] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // ── Mutations ──────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveCalendarEvent(id),
    onSuccess: () => { showAppToast('Событие одобрено'); invalidate(); },
    onError: () => showAppToast('Ошибка', undefined, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCalendarEvent(id),
    onSuccess: () => { showAppToast('Событие удалено'); setSelectedEvent(null); invalidate(); },
    onError: () => showAppToast('Ошибка', undefined, 'error'),
  });

  const moveBack = () => setCursorDate((d) => subMonths(d, 1));
  const moveForward = () => setCursorDate((d) => addMonths(d, 1));

  if (eventsQuery.isError && events.length === 0) {
    return <ErrorState title="Календарь не загрузился" onRetry={() => eventsQuery.refetch()} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 pb-24 safe-area">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-[9px] font-bold text-white">
            {currentUser.fullName?.slice(0, 2).toUpperCase() ?? 'QA'}
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Календарь отсутствий</h1>
            <p className="text-[10px] font-medium text-white/40">
              {eventsQuery.data ? `${events.length} событий · ${todayEvents.length} сегодня` : 'Загрузка...'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { hapticSelection(); navigate('/notifications'); }}
          className="relative grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-white/50"
          aria-label="Уведомления"
        >
          <Bell size={16} />
        </button>
      </header>

      {/* Filter Panel */}
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Команда" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="ALL">Все команды</option>
            {teams.map((team: Team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </Select>
          <Select label="Тип" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CalendarFilter)}>
            {Object.entries(FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        {/* Quick filter chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'HOLIDAY'] as CalendarFilter[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold transition ${
                typeFilter === type ? 'bg-white/[0.10] text-white' : 'bg-white/[0.04] text-white/50'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
              {FILTER_LABELS[type]}
            </button>
          ))}
        </div>
      </Card>

      {/* Calendar Navigation */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={moveBack} aria-label="Предыдущий месяц">
            <ChevronLeft size={16} />
          </Button>
          <div className="text-center">
            <h2 className="text-sm font-bold text-white">
              {format(cursorDate, 'LLLL yyyy', { locale: ru })}
            </h2>
            <button
              type="button"
              onClick={() => setCursorDate(new Date())}
              className="text-[10px] font-bold text-blue-400"
            >
              Сегодня
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={moveForward} aria-label="Следующий месяц">
            <ChevronRight size={16} />
          </Button>
        </div>

        {eventsQuery.isLoading && events.length === 0 ? (
          <CalendarSkeleton />
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-white/30 mb-1">
              {DAYS.map((day) => <span key={day}>{day}</span>)}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
              {visibleDays.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dayStr) ?? [];
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, cursorDate);

                return (
                  <div
                    key={dayStr}
                    className={`min-h-16 rounded-[10px] p-1.5 transition ${
                      isCurrentMonth ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
                    } ${isToday ? 'ring-2 ring-[#4C7DFF]/50' : ''}`}
                  >
                    <div className={`text-[10px] font-bold mb-1 ${
                      isCurrentMonth ? 'text-white/60' : 'text-white/20'
                    } ${isToday ? 'text-[#4C7DFF]' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="grid gap-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className="flex items-center gap-1 rounded-[4px] px-1 py-0.5 text-[8px] font-bold text-white truncate transition hover:opacity-80"
                          style={{ backgroundColor: TYPE_COLORS[event.type] + '40' }}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[event.type] }} />
                          <span className="truncate">{event.user.fullName}</span>
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setTypeFilter('ALL')}
                          className="text-[8px] font-bold text-white/30 hover:text-white/50 text-left"
                        >
                          +{dayEvents.length - 2}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* No events */}
      {!eventsQuery.isLoading && events.length === 0 && (
        <EmptyState title="Нет событий" description="За этот месяц событий не найдено." />
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => { hapticSelection(); setShowCreateModal(true); }}
        className="fixed bottom-[calc(5rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] right-5 z-20 grid h-12 w-12 place-items-center rounded-2xl app-gradient text-white shadow-lg shadow-blue-500/30 active:scale-90 transition-transform"
        aria-label="Создать событие"
      >
        <Plus size={22} />
      </button>

      {/* Create Event Modal */}
      <CreateEventModal
        open={showCreateModal}
        isAdmin={isAdmin}
        isManager={isManager}
        teams={teams}
        currentUserId={currentUser.id}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => { setShowCreateModal(false); invalidate(); }}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          isManager={isManager}
          onClose={() => setSelectedEvent(null)}
          onApprove={() => approveMutation.mutate(selectedEvent.id)}
          onDelete={() => deleteMutation.mutate(selectedEvent.id)}
          isMutating={approveMutation.isPending || deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventModal({
  open,
  isAdmin,
  isManager,
  teams,
  currentUserId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  isAdmin: boolean;
  isManager: boolean;
  teams: Team[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<CalendarEventType>('TIME_OFF');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState(currentUserId);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.createCalendarEvent({ type, startDate, endDate, userId: userId !== currentUserId ? userId : undefined, comment: comment || undefined }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  if (!open) return null;

  const eventTypes: Array<{ value: CalendarEventType; label: string; adminOnly?: boolean }> = [
    { value: 'VACATION', label: 'Отпуск' },
    { value: 'TIME_OFF', label: 'Отгул' },
    { value: 'SICK_LEAVE', label: 'Больничный' },
    { value: 'HOLIDAY', label: 'Праздник', adminOnly: true },
  ];

  const isValid = type && startDate && endDate;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 backdrop-blur-sm sm:place-items-center">
      <section className="enterprise-card w-full max-w-md p-4 animate-slideUp">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/30">Новое событие</p>
            <h2 className="text-sm font-bold text-white">Создать отсутствие</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </Button>
        </div>

        <div className="grid gap-3">
          <Select label="Тип" value={type} onChange={(e) => setType(e.target.value as CalendarEventType)}>
            {eventTypes.filter((t) => !t.adminOnly || isAdmin).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Дата начала" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="Дата окончания" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {isManager && (
            <Select label="Сотрудник" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value={currentUserId}>Себя</option>
              {teams.flatMap((team) =>
                (team.users ?? []).filter((u) => u.id !== currentUserId).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName} ({team.name})</option>
                ))
              )}
            </Select>
          )}

          <Textarea label="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} hint={`${comment.length}/500`} />

          {error && <div className="rounded-[10px] bg-rose-500/10 p-3 text-xs font-medium text-rose-400">{error}</div>}
        </div>

        <div className="mt-4">
          <Button className="w-full" disabled={!isValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Создание...' : 'Создать событие'}
          </Button>
        </div>
      </section>
    </div>
  );
}

// ── Event Detail Modal ───────────────────────────────────────────────────────

function EventDetailModal({
  event,
  isManager,
  onClose,
  onApprove,
  onDelete,
  isMutating,
}: {
  event: CalendarEventEntry;
  isManager: boolean;
  onClose: () => void;
  onApprove: () => void;
  onDelete: () => void;
  isMutating: boolean;
}) {
  const Icon = TYPE_ICONS[event.type] ?? Plane;
  const color = TYPE_COLORS[event.type] ?? '#64748B';
  const canManage = isManager && event.status === 'PENDING';

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 backdrop-blur-sm sm:place-items-center">
      <section className="enterprise-card w-full max-w-md p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundColor: color }}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{event.user.fullName}</p>
              <p className="text-[10px] font-medium text-white/50">{FILTER_LABELS[event.type]}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </Button>
        </div>

        <div className="grid gap-1.5 rounded-[12px] bg-white/[0.04] p-3 text-xs font-medium">
          <InfoRow label="Даты" value={`${format(parseISO(event.startDate), 'd MMM', { locale: ru })} - ${format(parseISO(event.endDate), 'd MMMM yyyy', { locale: ru })}`} />
          <InfoRow label="Статус" value={event.status === 'PENDING' ? 'Ожидает' : event.status === 'APPROVED' ? 'Одобрено' : event.status} />
          {event.comment && <InfoRow label="Комментарий" value={event.comment} />}
        </div>

        {canManage && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="danger" disabled={isMutating} onClick={onDelete}>
              <X size={16} /> Удалить
            </Button>
            <Button disabled={isMutating} onClick={onApprove}>
              Одобрить
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className="text-right text-white/80">{value}</span>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => <Skeleton key={d} className="h-3" />)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-[10px]" />
        ))}
      </div>
    </>
  );
}
