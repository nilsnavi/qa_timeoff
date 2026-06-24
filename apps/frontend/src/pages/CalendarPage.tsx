import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, Plane, Stethoscope, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Modal, Select, Skeleton, SkeletonCard, StatusBadge } from '../components/ui';
import { api } from '../shared/api';
import type { CalendarEvent } from '../shared/types';

type CalendarView = 'month' | 'week' | 'list';
type AbsenceFilter = 'ALL' | 'VACATION' | 'TIME_OFF' | 'SICK_LEAVE' | 'HOLIDAY';

const viewOptions: Array<{ value: CalendarView; label: string; icon: typeof CalendarDays }> = [
  { value: 'month', label: 'Месяц', icon: CalendarDays },
  { value: 'week', label: 'Неделя', icon: Clock3 },
  { value: 'list', label: 'Список', icon: List },
];

const absenceLabels: Record<AbsenceFilter, string> = {
  ALL: 'Все типы',
  VACATION: 'Отпуск',
  TIME_OFF: 'Отгул',
  SICK_LEAVE: 'Больничный',
  HOLIDAY: 'Праздник',
};

const markerColors: Record<AbsenceFilter, string> = {
  ALL: '#64748B',
  VACATION: '#22C55E',
  TIME_OFF: '#2563EB',
  SICK_LEAVE: '#8B5CF6',
  HOLIDAY: '#F97316',
};

export function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month');
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [teamId, setTeamId] = useState('ALL');
  const [absenceType, setAbsenceType] = useState<AbsenceFilter>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const calendarQuery = useQuery({
    queryKey: ['calendar', teamId],
    queryFn: () => (teamId === 'ALL' ? api.calendar() : api.calendarTeam(teamId)),
  });
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: api.teams,
  });

  const calendar = calendarQuery.data ?? { approved: [], pending: [] };
  const events = useMemo(() => [...(calendar.approved ?? []), ...(calendar.pending ?? [])], [calendar.approved, calendar.pending]);
  const teams = teamsQuery.data ?? [];
  const teamNames = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const teamOptions = useMemo(() => {
    const eventTeams = new Set(events.map((event) => event.employee.teamId).filter(Boolean));

    return [
      ...teams.map((team) => ({ id: team.id, name: team.name })),
      ...[...eventTeams]
        .filter((id): id is string => !!id && !teamNames.has(id))
        .map((id) => ({ id, name: `Команда ${id.slice(0, 6)}` })),
    ];
  }, [events, teamNames, teams]);

  const filteredEvents = useMemo(
    () =>
      events
        .filter((event) => absenceType === 'ALL' || getAbsenceKind(event) === absenceType)
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.employee.fullName.localeCompare(b.employee.fullName)),
    [absenceType, events],
  );
  const visibleDays = useMemo(() => {
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(cursorDate, { weekStartsOn: 1 }),
        end: endOfWeek(cursorDate, { weekStartsOn: 1 }),
      });
    }

    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 1 }),
    });
  }, [cursorDate, view]);
  const upcomingEvents = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return filteredEvents.filter((event) => event.endDate >= today).slice(0, 5);
  }, [filteredEvents]);
  const rangeTitle =
    view === 'week'
      ? `${format(visibleDays[0], 'd MMM', { locale: ru })} - ${format(visibleDays[visibleDays.length - 1], 'd MMM', { locale: ru })}`
      : format(cursorDate, 'LLLL yyyy', { locale: ru });

  if (calendarQuery.isError) {
    return (
      <ErrorState
        title="Календарь не загрузился"
        description="Проверьте подключение и попробуйте еще раз."
        onRetry={() => calendarQuery.refetch()}
      />
    );
  }

  if (calendarQuery.isLoading) {
    return <CalendarSkeleton />;
  }

  const moveBack = () => setCursorDate((date) => (view === 'week' ? subWeeks(date, 1) : subMonths(date, 1)));
  const moveForward = () => setCursorDate((date) => (view === 'week' ? addWeeks(date, 1) : addMonths(date, 1)));

  return (
    <>
      <Card>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Календарь отсутствий</h2>
              <p className="text-sm font-bold text-[#7A8599]">Событий: {filteredEvents.length}</p>
            </div>
            <ViewSwitcher view={view} onChange={setView} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Команда" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="ALL">Все команды</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
            <Select label="Тип отсутствия" value={absenceType} onChange={(event) => setAbsenceType(event.target.value as AbsenceFilter)}>
              {Object.entries(absenceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <Legend />
        </div>
      </Card>

      {view === 'list' ? (
        <EventList events={filteredEvents} teamNames={teamNames} onSelect={setSelectedEvent} />
      ) : (
        <>
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" onClick={moveBack} aria-label="Предыдущий период">
                <ChevronLeft size={18} />
              </Button>
              <div className="text-center">
                <h2 className="text-lg font-black text-white">{rangeTitle}</h2>
                <button type="button" className="text-xs font-black text-blue-300" onClick={() => setCursorDate(new Date())}>
                  Сегодня
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={moveForward} aria-label="Следующий период">
                <ChevronRight size={18} />
              </Button>
            </div>

            <CalendarGrid
              days={visibleDays}
              cursorDate={cursorDate}
              view={view}
              events={filteredEvents}
              onSelect={setSelectedEvent}
            />
          </Card>

          <UpcomingList events={upcomingEvents} teamNames={teamNames} onSelect={setSelectedEvent} />
        </>
      )}

      <EventModal
        event={selectedEvent}
        teamName={selectedEvent?.employee.teamId ? teamNames.get(selectedEvent.employee.teamId) : undefined}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

function ViewSwitcher({ view, onChange }: { view: CalendarView; onChange: (view: CalendarView) => void }) {
  return (
    <div className="flex rounded-[20px] bg-[#111A2E]/70 p-1 ring-1 ring-white/[0.10] bg-[#111A2E]/70 ring-white/[0.06]">
      {viewOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          aria-label={option.label}
          onClick={() => onChange(option.value)}
          className={`grid h-10 w-10 place-items-center rounded-2xl transition ${
            view === option.value ? 'app-gradient text-white shadow-lg shadow-blue-500/20' : 'text-[#B8C0D0]'
          }`}
        >
          <option.icon size={18} />
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'HOLIDAY'] as AbsenceFilter[]).map((type) => (
        <span key={type} className="inline-flex items-center gap-2 rounded-full bg-[#111A2E]/65 px-3 py-2 text-xs font-black text-[#7A8599] bg-[#111A2E]/65 text-[#7A8599]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: markerColors[type] }} />
          {absenceLabels[type]}
        </span>
      ))}
    </div>
  );
}

function CalendarGrid({
  days,
  cursorDate,
  view,
  events,
  onSelect,
}: {
  days: Date[];
  cursorDate: Date;
  view: CalendarView;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-[#7A8599]">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            day={day}
            compact={view === 'month'}
            muted={view === 'month' && !isSameMonth(day, cursorDate)}
            events={eventsForDay(events, day)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}

function CalendarSkeleton() {
  return (
    <>
      <SkeletonCard rows={3} />
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="grid flex-1 place-items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-[18px]" />
          ))}
        </div>
      </Card>
    </>
  );
}

function DayCell({
  day,
  compact,
  muted,
  events,
  onSelect,
}: {
  day: Date;
  compact: boolean;
  muted: boolean;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
}) {
  const shownEvents = compact ? events.slice(0, 2) : events.slice(0, 5);

  return (
    <div
      className={`min-h-24 rounded-[18px] p-1.5 ring-1 ring-white/[0.10] ring-white/[0.06] ${
        muted ? 'bg-white/35 bg-slate-900/35' : 'bg-[#111A2E]/70 bg-[#111A2E]/70'
      } ${isSameDay(day, new Date()) ? 'ring-2 ring-blue-400/70' : ''}`}
    >
      <div className={`mb-1 text-xs font-black ${muted ? 'text-[#7A8599]' : 'text-[#B8C0D0]'}`}>{format(day, 'd')}</div>
      <div className="grid gap-1">
        {shownEvents.map((event) => (
          <button
            key={`${event.absenceType}-${event.id}`}
            type="button"
            onClick={() => onSelect(event)}
            className="flex min-h-7 items-center gap-1.5 rounded-xl bg-[#111A2E]/75 px-2 text-left text-[11px] font-black text-[#B8C0D0] shadow-sm transition active:scale-[0.98] bg-[#111A2E]/80 text-white"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getEventColor(event) }} />
            <span className="truncate">{event.employee.fullName}</span>
          </button>
        ))}
        {events.length > shownEvents.length && <span className="px-2 text-[11px] font-black text-[#7A8599]">+{events.length - shownEvents.length}</span>}
      </div>
    </div>
  );
}

function UpcomingList({
  events,
  teamNames,
  onSelect,
}: {
  events: CalendarEvent[];
  teamNames: Map<string, string>;
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <Card>
      <h3 className="mb-3 text-base font-black text-white">Ближайшие отсутствия</h3>
      {events.length === 0 ? (
        <p className="text-sm font-bold text-[#7A8599]">Ближайших событий нет</p>
      ) : (
        <CompactEventList events={events} teamNames={teamNames} onSelect={onSelect} />
      )}
    </Card>
  );
}

function EventList({
  events,
  teamNames,
  onSelect,
}: {
  events: CalendarEvent[];
  teamNames: Map<string, string>;
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <Card>
      {events.length === 0 ? (
        <EmptyState title="Событий нет" description="Попробуйте изменить фильтры или выбрать другой период." />
      ) : (
        <CompactEventList events={events} teamNames={teamNames} onSelect={onSelect} />
      )}
    </Card>
  );
}

function CompactEventList({
  events,
  teamNames,
  onSelect,
}: {
  events: CalendarEvent[];
  teamNames: Map<string, string>;
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <div className="grid gap-2">
      {events.map((event) => (
        <button
          key={`${event.absenceType}-${event.id}`}
          type="button"
          onClick={() => onSelect(event)}
          className="flex items-center justify-between gap-3 rounded-[20px] bg-[#111A2E]/70 p-3 text-left transition active:scale-[0.99] bg-[#111A2E]/70"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Marker event={event} />
            <div className="min-w-0">
              <p className="truncate font-black text-white">{event.employee.fullName}</p>
              <p className="truncate text-sm font-bold text-[#7A8599]">
                {getAbsenceLabel(event)} · {formatRange(event)}
              </p>
              {event.employee.teamId && <p className="truncate text-xs font-bold text-[#7A8599]">{teamNames.get(event.employee.teamId) ?? 'Команда'}</p>}
            </div>
          </div>
          <StatusBadge status={event.status} />
        </button>
      ))}
    </div>
  );
}

function EventModal({ event, teamName, onClose }: { event: CalendarEvent | null; teamName?: string; onClose: () => void }) {
  return (
    <Modal open={!!event} title={event ? getAbsenceLabel(event) : 'Событие'} onClose={onClose}>
      {event && (
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <Marker event={event} />
            <div className="min-w-0">
              <p className="text-lg font-black text-white">{event.employee.fullName}</p>
              <p className="text-sm font-bold text-[#7A8599]">{event.employee.position ?? teamName ?? 'Участник команды'}</p>
            </div>
          </div>
          <div className="grid gap-2 rounded-[20px] bg-[#111A2E]/70 p-4 text-sm font-bold text-[#7A8599] bg-[#111A2E]/70 text-[#7A8599]">
            <InfoRow label="Даты" value={formatRange(event)} />
            {teamName && <InfoRow label="Команда" value={teamName} />}
            {event.hours !== undefined && <InfoRow label="Часы" value={`${event.hours} ч`} />}
            {event.daysCount !== undefined && <InfoRow label="Дни" value={`${event.daysCount} дн.`} />}
            {event.reason && <InfoRow label="Причина" value={event.reason} />}
            {event.comment && <InfoRow label="Комментарий" value={event.comment} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            <Badge tone="info">{getAbsenceLabel(event)}</Badge>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#7A8599]">{label}</span>
      <span className="text-right text-[#B8C0D0]">{value}</span>
    </div>
  );
}

function Marker({ event }: { event: CalendarEvent }) {
  const Icon = getAbsenceIcon(event);

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-white shadow-lg shadow-slate-300/30" style={{ backgroundColor: getEventColor(event) }}>
      <Icon size={20} />
    </span>
  );
}

function eventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter((event) =>
    isWithinInterval(day, {
      start: parseISO(event.startDate),
      end: parseISO(event.endDate),
    }),
  );
}

function getAbsenceKind(event: CalendarEvent): AbsenceFilter {
  if (event.absenceType === 'HOLIDAY') {
    return 'HOLIDAY';
  }

  if (event.vacationType === 'SICK_LEAVE') {
    return 'SICK_LEAVE';
  }

  return event.absenceType;
}

function getAbsenceLabel(event: CalendarEvent) {
  return absenceLabels[getAbsenceKind(event)];
}

function getAbsenceIcon(event: CalendarEvent) {
  const kind = getAbsenceKind(event);

  if (kind === 'TIME_OFF') {
    return Clock3;
  }
  if (kind === 'SICK_LEAVE') {
    return Stethoscope;
  }
  if (kind === 'HOLIDAY') {
    return Sun;
  }

  return Plane;
}

function getEventColor(event: CalendarEvent) {
  return markerColors[getAbsenceKind(event)];
}

function formatRange(event: CalendarEvent) {
  if (event.startDate === event.endDate) {
    return format(parseISO(event.startDate), 'd MMMM yyyy', { locale: ru });
  }

  return `${format(parseISO(event.startDate), 'd MMM', { locale: ru })} - ${format(parseISO(event.endDate), 'd MMMM yyyy', { locale: ru })}`;
}
