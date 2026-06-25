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
import { ChevronLeft, ChevronRight, Clock, Edit3, Plane, Plus, Stethoscope, Sun, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, CustomSelect, EmptyState, ErrorState, Input, Skeleton, Textarea } from '../../components/ui';
import type { SelectOption } from '../../components/ui/CustomSelect';
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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const currentUser = dashboard.user;
  const [cursorDate, setCursorDate] = useState(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [typeFilter, setTypeFilter] = useState<CalendarFilter>('ALL');
  const [teamId, setTeamId] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'));

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

  const teamOptions: SelectOption[] = [
    { value: 'ALL', label: 'Все команды' },
    ...(teamsQuery.data ?? []).map((t: Team) => ({ value: t.id, label: t.name })),
  ];

  const typeOptions: SelectOption[] = Object.entries(FILTER_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

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

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter(e => e.status === 'APPROVED' && new Date(e.startDate) >= today)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  }, [events]);

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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Календарь</h1>
          <p className="text-[14px] text-white/40 mt-0.5">
            {eventsQuery.data ? `${events.length} событий · ${todayEvents.length} сегодня` : 'Загрузка...'}
          </p>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl app-gradient px-4 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
          >
            <Plus size={16} />
            Создать событие
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {/* ═══ LEFT COLUMN ═══ */}
        <div className="flex flex-col gap-4">
          {/* Filter Panel */}
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <div className="field-shell">
                <span className="field-label">Команда</span>
                <CustomSelect
                  value={teamId}
                  onChange={setTeamId}
                  options={teamOptions}
                />
              </div>
              <div className="field-shell">
                <span className="field-label">Тип</span>
                <CustomSelect
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as CalendarFilter)}
                  options={typeOptions}
                />
              </div>
            </div>
            {/* Quick filter chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'HOLIDAY'] as CalendarFilter[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                    typeFilter === type ? 'bg-white/[0.10] text-white' : 'bg-white/[0.04] text-white/50'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                  {FILTER_LABELS[type]}
                </button>
              ))}
            </div>
          </Card>

          {/* Mini-stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="enterprise-card p-4 text-center">
              <p className="text-[12px] font-medium text-white/45 mb-1">Сегодня</p>
              <p className="text-[24px] font-bold text-white">{todayEvents.length}</p>
              <p className="text-[12px] text-white/30">отсутствий</p>
            </div>
            <div className="enterprise-card p-4 text-center">
              <p className="text-[12px] font-medium text-white/45 mb-1">За месяц</p>
              <p className="text-[24px] font-bold text-white">{events.length}</p>
              <p className="text-[12px] text-white/30">событий</p>
            </div>
            <div className="enterprise-card p-4 text-center">
              <p className="text-[12px] font-medium text-white/45 mb-1">Ожидают</p>
              <p className="text-[24px] font-bold text-amber-400">
                {events.filter(e => e.status === 'PENDING').length}
              </p>
              <p className="text-[12px] text-white/30">согласования</p>
            </div>
          </div>

          {/* Calendar Navigation */}
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" onClick={moveBack} aria-label="Предыдущий месяц">
                <ChevronLeft size={16} />
              </Button>
              <div className="text-center">
                <h2 className="text-[18px] font-bold text-white">
                  {format(cursorDate, 'LLLL yyyy', { locale: ru })}
                </h2>
                <button
                  type="button"
                  onClick={() => setCursorDate(new Date())}
                  className="text-[13px] font-semibold text-[#4C7DFF]"
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
                <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-white/40 mb-1">
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
                        onClick={() => setSelectedDay(dayStr)}
                        className={`min-h-[80px] rounded-xl p-2 transition cursor-pointer hover:ring-1 hover:ring-white/20 ${
                          isCurrentMonth ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
                        } ${isToday ? 'ring-2 ring-[#4C7DFF]/50' : ''} ${
                          selectedDay === dayStr ? 'ring-2 ring-[#4C7DFF]/70' : ''
                        }`}
                      >
                        <div className={`text-[13px] font-semibold mb-1.5 ${
                          isCurrentMonth ? 'text-white/60' : 'text-white/20'
                        } ${isToday ? 'text-[#4C7DFF]' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="grid gap-0.5">
                          {dayEvents.slice(0, 2).map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                              className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-white truncate transition hover:opacity-80"
                              style={{ backgroundColor: TYPE_COLORS[event.type] + '40' }}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[event.type] }} />
                              <span className="truncate">{event.user.fullName}</span>
                            </button>
                          ))}
                          {dayEvents.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setTypeFilter('ALL')}
                              className="text-[11px] font-semibold text-white/30 hover:text-white/50 text-left"
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

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <div className="enterprise-card p-5">
              <p className="text-[14px] font-semibold text-white/50 mb-3">Ближайшие события</p>
              <div className="flex flex-col gap-2">
                {upcomingEvents.map(event => {
                  const color = TYPE_COLORS[event.type] ?? '#64748B';
                  const daysLeft = Math.ceil(
                    (new Date(event.startDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
                  );
                  return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedDay(event.startDate.slice(0, 10))}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors"
                    >
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white/80 truncate">
                          {event.user.fullName}
                        </p>
                        <p className="text-[12px] text-white/40">
                          {FILTER_LABELS[event.type as CalendarFilter]} ·{' '}
                          {format(parseISO(event.startDate), 'd MMM', { locale: ru })}
                          {event.startDate !== event.endDate && ` — ${format(parseISO(event.endDate), 'd MMM', { locale: ru })}`}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[13px] font-bold ${
                        daysLeft === 0 ? 'text-emerald-400' : daysLeft <= 3 ? 'text-amber-400' : 'text-white/30'
                      }`}>
                        {daysLeft === 0 ? 'Сегодня' : `${daysLeft}дн`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <DayDetailPanel
          selectedDay={selectedDay}
          eventsByDate={eventsByDate}
          isManager={isManager}
          onApprove={(id) => approveMutation.mutate(id)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onEdit={(event) => { setEditingEvent(event); setShowCreateModal(true); }}
          isMutating={approveMutation.isPending || deleteMutation.isPending}
        />
      </div>

      {/* Create/Edit Event Modal */}
      <CreateEventModal
        open={showCreateModal}
        editingEvent={editingEvent}
        isAdmin={isAdmin}
        isManager={isManager}
        teams={teams}
        currentUserId={currentUser.id}
        onClose={() => { setShowCreateModal(false); setEditingEvent(null); }}
        onSuccess={() => { setShowCreateModal(false); setEditingEvent(null); invalidate(); }}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          isManager={isManager}
          onClose={() => setSelectedEvent(null)}
          onApprove={() => approveMutation.mutate(selectedEvent.id)}
          onDelete={() => deleteMutation.mutate(selectedEvent.id)}
          onEdit={() => { setEditingEvent(selectedEvent); setSelectedEvent(null); setShowCreateModal(true); }}
          isMutating={approveMutation.isPending || deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Day Detail Panel ─────────────────────────────────────────────────────

function DayDetailPanel({
  selectedDay,
  eventsByDate,
  isManager,
  onApprove,
  onDelete,
  onEdit,
  isMutating,
}: {
  selectedDay: string | null;
  eventsByDate: Map<string, CalendarEventEntry[]>;
  isManager: boolean;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (event: CalendarEventEntry) => void;
  isMutating: boolean;
}) {
  const dayEvents = selectedDay ? (eventsByDate.get(selectedDay) ?? []) : [];
  const dayLabel = selectedDay
    ? format(parseISO(selectedDay), 'd MMMM yyyy, EEEE', { locale: ru })
    : null;

  return (
    <div className="enterprise-card p-5 sticky top-6">
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-white/50">
          {dayLabel ?? 'Выберите день'}
        </p>
        {dayEvents.length > 0 && (
          <p className="text-[13px] text-white/35 mt-0.5">
            {dayEvents.length} {dayEvents.length === 1 ? 'событие' : 'событий'}
          </p>
        )}
      </div>

      {dayEvents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.04]">
            <Sun size={20} className="text-white/25" />
          </div>
          <p className="text-[14px] font-medium text-white/35">Нет событий</p>
          <p className="text-[12px] text-white/25">В этот день все на месте</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayEvents.map(event => {
            const Icon = TYPE_ICONS[event.type] ?? Plane;
            const color = TYPE_COLORS[event.type] ?? '#64748B';
            return (
              <div
                key={event.id}
                className="rounded-xl p-3 border border-white/[0.06]"
                style={{ background: color + '0D' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ backgroundColor: color + '25' }}
                  >
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-white truncate">
                      {event.user.fullName}
                    </p>
                    <p className="text-[12px] text-white/50">
                      {FILTER_LABELS[event.type as CalendarFilter]}
                    </p>
                    <p className="text-[12px] text-white/35 mt-0.5">
                      {format(parseISO(event.startDate), 'd MMM', { locale: ru })}
                      {' — '}
                      {format(parseISO(event.endDate), 'd MMM yyyy', { locale: ru })}
                    </p>
                  </div>
                  <Badge tone={event.status === 'APPROVED' ? 'success' : 'warning'} className="text-[11px] shrink-0">
                    {event.status === 'APPROVED' ? 'Одобрено' : 'Ожидает'}
                  </Badge>
                </div>

                {event.comment && (
                  <p className="mt-2 text-[12px] text-white/40 pl-12 truncate">
                    {event.comment}
                  </p>
                )}

                {isManager && (
                  <div className="flex gap-2 mt-2 pl-12">
                    <button
                      type="button"
                      onClick={() => onEdit(event)}
                      className="text-[12px] font-semibold text-white/40 hover:text-white/70 transition-colors"
                    >
                      Изменить
                    </button>
                    {event.status === 'PENDING' && (
                      <>
                        <span className="text-white/20">·</span>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => onApprove(event.id)}
                          className="text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Одобрить
                        </button>
                        <span className="text-white/20">·</span>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => onDelete(event.id)}
                          className="text-[12px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventModal({
  open,
  editingEvent,
  isAdmin,
  isManager,
  teams,
  currentUserId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  editingEvent?: CalendarEventEntry | null;
  isAdmin: boolean;
  isManager: boolean;
  teams: Team[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<CalendarEventType>(editingEvent?.type ?? 'TIME_OFF');
  const [startDate, setStartDate] = useState(editingEvent ? editingEvent.startDate.slice(0, 10) : '');
  const [endDate, setEndDate] = useState(editingEvent ? editingEvent.endDate.slice(0, 10) : '');
  const [userId, setUserId] = useState(editingEvent?.userId ?? currentUserId);
  const [comment, setComment] = useState(editingEvent?.comment ?? '');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.createCalendarEvent({ type, startDate, endDate, userId: userId !== currentUserId ? userId : undefined, comment: comment || undefined }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateCalendarEvent(editingEvent!.id, { type, startDate, endDate, comment: comment || undefined }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  if (!open) return null;

  const isEditing = !!editingEvent;

  const eventTypes: Array<{ value: CalendarEventType; label: string; adminOnly?: boolean }> = [
    { value: 'VACATION', label: 'Отпуск' },
    { value: 'TIME_OFF', label: 'Отгул' },
    { value: 'SICK_LEAVE', label: 'Больничный' },
    { value: 'HOLIDAY', label: 'Праздник', adminOnly: true },
  ];

  const typeOptions: SelectOption[] = eventTypes
    .filter((t) => !t.adminOnly || isAdmin)
    .map((t) => ({ value: t.value, label: t.label }));

  const userOptions: SelectOption[] = [
    { value: currentUserId, label: 'Себя' },
    ...teams.flatMap((team) =>
      (team.users ?? []).filter((u) => u.id !== currentUserId).map((u) => ({
        value: u.id,
        label: `${u.fullName} (${team.name})`,
      }))
    ),
  ];

  const isValid = type && startDate && endDate;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 backdrop-blur-sm sm:place-items-center">
      <section className="enterprise-card w-full max-w-md p-4 animate-slideUp">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/30">{isEditing ? 'Редактирование' : 'Новое событие'}</p>
            <h2 className="text-sm font-bold text-white">{isEditing ? 'Редактировать отсутствие' : 'Создать отсутствие'}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </Button>
        </div>

        <div className="grid gap-3">
          <div className="field-shell">
            <span className="field-label">Тип</span>
            <CustomSelect
              value={type}
              onChange={(v) => setType(v as CalendarEventType)}
              options={typeOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Дата начала" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="Дата окончания" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {(isManager || isEditing) && (
            <div className="field-shell">
              <span className="field-label">Сотрудник</span>
              <CustomSelect
                value={userId}
                onChange={setUserId}
                options={userOptions}
              />
            </div>
          )}

          <Textarea label="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} hint={`${comment.length}/500`} />

          {error && <div className="rounded-[10px] bg-rose-950/300/10 p-3 text-xs font-medium text-rose-400">{error}</div>}
        </div>

        <div className="mt-4">
          <Button className="w-full" disabled={!isValid || createMutation.isPending || updateMutation.isPending} onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}>
            {(createMutation.isPending || updateMutation.isPending) ? 'Сохранение...' : isEditing ? 'Сохранить изменения' : 'Создать событие'}
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
  onEdit,
  isMutating,
}: {
  event: CalendarEventEntry;
  isManager: boolean;
  onClose: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onEdit: () => void;
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
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundColor: color }}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">{event.user.fullName}</p>
              <p className="text-[13px] font-medium text-white/50">{FILTER_LABELS[event.type]}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </Button>
        </div>

        <div className="grid gap-1.5 rounded-[12px] bg-white/[0.04] p-3 text-[14px] font-medium">
          <InfoRow label="Даты" value={`${format(parseISO(event.startDate), 'd MMM', { locale: ru })} - ${format(parseISO(event.endDate), 'd MMMM yyyy', { locale: ru })}`} />
          <InfoRow label="Статус" value={event.status === 'PENDING' ? 'Ожидает' : event.status === 'APPROVED' ? 'Одобрено' : event.status} />
          {event.comment && <InfoRow label="Комментарий" value={event.comment} />}
        </div>

        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Edit3 size={14} /> Редактировать
          </Button>
          {canManage && (
            <>
              <Button variant="danger" size="sm" disabled={isMutating} onClick={onDelete}>
                <X size={14} /> Удалить
              </Button>
              <Button size="sm" disabled={isMutating} onClick={onApprove}>
                Одобрить
              </Button>
            </>
          )}
        </div>
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
          <Skeleton key={i} className="h-20 rounded-[12px]" />
        ))}
      </div>
    </>
  );
}
