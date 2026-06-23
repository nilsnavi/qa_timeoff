import {
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock3,
  History,
  Plane,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ErrorState, Skeleton } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { Role } from '../shared/types';
import { getRoleLabel, getStatusLabel } from '../shared/utils';

// ─── Month names (Russian locale) ────────────────────────────────────────
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// ─── Helpers ─────────────────────────────────────────────────────────────

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0 = Sunday, 1 = Monday ... 6 = Saturday
  // We want Monday = 0 ... Sunday = 6
  const jsDay = new Date(year, month, 1).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function formatDate(date: string) {
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTHS_GENITIVE[d.getMonth()];
  const year = d.getFullYear();
  const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const wd = weekdays[d.getDay()];
  return `${day} ${month} ${year} (${wd})`;
}

function daysUntil(date: string) {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Прошло';
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  return `Через ${days} дн.`;
}

// ─── Main Component ──────────────────────────────────────────────────────

export function HomePage() {
  const { dashboard, data, isError, isLoading, refetch } = useDashboard();
  const navigate = useNavigate();

  // Calendar state (must be before early returns — Rules of Hooks)
  const today = new Date();
  const [calYear] = useState(today.getFullYear());
  const [calMonth] = useState(today.getMonth()); // 0-based

  if (isError && !data) {
    return (
      <ErrorState
        title="Главный экран не загрузился"
        description="Не удалось получить баланс, события и операции."
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading && !data) {
    return <HomeSkeleton />;
  }

  const user = dashboard.user;
  const balance = dashboard.balance;

  // ── Next upcoming event ──────────────────────────────────────────
  const allEvents = [
    ...dashboard.requests.map((r) => ({
      id: r.id,
      type: 'Отгул' as const,
      date: r.date,
      status: r.status,
    })),
    ...(dashboard.vacations ?? []).map((v) => ({
      id: v.id,
      type: 'Отпуск' as const,
      date: v.startDate,
      status: v.status,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const nextEvent = allEvents.find((e) => new Date(e.date) >= new Date()) ?? null;

  // ── Requests summary ─────────────────────────────────────────────
  const allRequests = [
    ...dashboard.requests.map((r) => ({ status: r.status })),
    ...(dashboard.vacations ?? []).map((v) => ({ status: v.status })),
  ];
  const pendingCount = allRequests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = allRequests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = allRequests.filter((r) => r.status === 'REJECTED').length;
  const totalCount = allRequests.length;

  // ── Calendar derived state ───────────────────────────────────────
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOffset = getFirstDayOfMonth(calYear, calMonth);
  const todayDate = today.getDate();
  const isCurrentMonth =
    today.getMonth() === calMonth && today.getFullYear() === calYear;

  // Build a set of "event dates" from requests/vacations (simplified)
  const eventDates = new Set<string>();
  for (const r of dashboard.requests) {
    eventDates.add(r.date);
  }
  for (const v of dashboard.vacations ?? []) {
    // Mark all days of vacation range
    const start = new Date(v.startDate);
    const end = new Date(v.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      eventDates.add(d.toISOString().slice(0, 10));
    }
  }

  // Simulated holiday/weekend markers (weekends)
  function isWeekend(year: number, month: number, day: number) {
    const d = new Date(year, month, day);
    const jsDay = d.getDay();
    return jsDay === 0 || jsDay === 6;
  }

  return (
    <div className="grid gap-4 pb-4">
      {/* ═══════════════════════════════════════════════════════════
           SECTION 1: PROFILE CARD
           ═══════════════════════════════════════════════════════════ */}
      <ProfileCard
        initials={getInitials(user.fullName)}
        fullName={user.fullName}
        role={user.role}
        position={user.position}
        onProfileClick={() => navigate('/profile')}
      />

      {/* ═══════════════════════════════════════════════════════════
           SECTION 2: TIME BALANCE (3 KPI cards)
           ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-3 gap-3">
        {/* Available */}
        <BalanceKPICard
          title="Доступно"
          value={`${balance.balanceHours}`}
          subtitle={`из ${balance.totalAddedHours} ч`}
          progress={balance.totalAddedHours > 0 ? balance.balanceHours / balance.totalAddedHours : 0}
          color="green"
        />
        {/* Accrued */}
        <BalanceKPICard
          title="Начислено"
          value={`${balance.totalAddedHours}`}
          subtitle="в этом году"
          progress={1}
          color="blue"
        />
        {/* Used */}
        <BalanceKPICard
          title="Использовано"
          value={`${balance.totalUsedHours}`}
          subtitle="в этом году"
          progress={balance.totalAddedHours > 0 ? balance.totalUsedHours / balance.totalAddedHours : 0}
          color="purple"
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 3: QUICK ACTIONS (4 grid)
           ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-4 gap-3">
        <QuickActionCard
          icon={Clock3}
          label="Отгул"
          gradient="from-blue-500 to-blue-600"
          onClick={() => navigate('/timeoff/new')}
        />
        <QuickActionCard
          icon={Plane}
          label="Отпуск"
          gradient="from-violet-500 to-purple-600"
          onClick={() => navigate('/vacation/new')}
        />
        <QuickActionCard
          icon={CalendarDays}
          label="Календарь"
          gradient="from-emerald-500 to-teal-600"
          onClick={() => navigate('/calendar')}
        />
        <QuickActionCard
          icon={History}
          label="История"
          gradient="from-amber-500 to-orange-600"
          onClick={() => navigate('/requests')}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 4: NEXT EVENT
           ═══════════════════════════════════════════════════════════ */}
      {nextEvent && (
        <NextEventCard
          type={nextEvent.type}
          date={nextEvent.date}
          status={nextEvent.status}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
           SECTION 5: REQUESTS SUMMARY
           ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-4 gap-3">
        <RequestsMiniCard
          label="Ожидают"
          value={pendingCount}
          color="amber"
          onClick={() => navigate('/requests')}
        />
        <RequestsMiniCard
          label="Одобрены"
          value={approvedCount}
          color="green"
          onClick={() => navigate('/requests')}
        />
        <RequestsMiniCard
          label="Отклонены"
          value={rejectedCount}
          color="red"
          onClick={() => navigate('/requests')}
        />
        <RequestsMiniCard
          label="Всего"
          value={totalCount}
          color="blue"
          onClick={() => navigate('/requests')}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 6: MINI CALENDAR
           ═══════════════════════════════════════════════════════════ */}
      <section className="glass-strong rounded-card-lg p-4">
        {/* Calendar Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white/90">
            {MONTHS_RU[calMonth]} {calYear}
          </h3>
          <span className="rounded-pill bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/50">
            Месяц
          </span>
        </div>

        {/* Weekday headers */}
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold text-white/40">
          {DAYS_SHORT.map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 text-center">
          {/* Empty offset cells */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`offset-${i}`} className="py-1" />
          ))}
          {/* Actual days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = isCurrentMonth && day === todayDate;
            const hasEvent = eventDates.has(dateStr);
            const isWeekendDay = isWeekend(calYear, calMonth, day);

            let dotColor = '';
            if (hasEvent) dotColor = 'bg-blue-500';
            else if (isWeekendDay) dotColor = 'bg-red-500';

            return (
              <button
                key={day}
                type="button"
                className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-sm font-semibold transition-colors hover:bg-white/5 ${
                  isToday
                    ? 'app-gradient text-white'
                    : 'text-white/70'
                }`}
              >
                <span>{day}</span>
                {dotColor && (
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${dotColor}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3">
          <LegendDot color="bg-green-500" label="Доступен" />
          <LegendDot color="bg-blue-500" label="Заявка" />
          <LegendDot color="bg-red-500" label="Выходной" />
          <LegendDot color="bg-yellow-500" label="Праздник" />
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

/* ── 1. Profile Card ──────────────────────────────────────────── */
function ProfileCard({
  initials,
  fullName,
  role,
  position,
  onProfileClick,
}: {
  initials: string;
  fullName: string;
  role: Role;
  position?: string;
  onProfileClick: () => void;
}) {
  return (
    <section className="glass-strong rounded-card-lg p-4 animate-fadeIn">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="grid h-14 w-14 place-items-center rounded-2xl app-gradient text-base font-black text-white shadow-lg shadow-blue-500/20">
            {initials}
          </div>
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0B1220] bg-green-500" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-white">{fullName}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="gradient" className="text-[11px]">
              {getRoleLabel(role)}
            </Badge>
            <span className="truncate text-xs font-semibold text-white/40">
              {position ?? 'QA-команда'} • Администратор системы
            </span>
          </div>
        </div>

        {/* Profile button */}
        <button
          type="button"
          onClick={onProfileClick}
          className="shrink-0 rounded-button border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Мой профиль
        </button>
      </div>
    </section>
  );
}

/* ── 2. Balance KPI Card ──────────────────────────────────────── */
function BalanceKPICard({
  title,
  value,
  subtitle,
  progress,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  color: 'green' | 'blue' | 'purple';
}) {
  const barColorMap = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  const glowMap = {
    green: 'shadow-green-500/15',
    blue: 'shadow-blue-500/15',
    purple: 'shadow-purple-500/15',
  };

  return (
    <section
      className={`glass-strong rounded-card-lg p-3.5 flex flex-col justify-between min-h-[96px] transition hover:bg-white/[0.08]`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
        {title}
      </p>
      <div>
        <p className="text-xl font-black text-white">{value}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/30">{subtitle}</p>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${barColorMap[color]} ${glowMap[color]} progress-fill`}
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>
    </section>
  );
}

/* ── 3. Quick Action Card ─────────────────────────────────────── */
function QuickActionCard({
  icon: Icon,
  label,
  gradient,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-strong rounded-card-lg flex flex-col items-center justify-center gap-2 p-3 min-h-[80px] transition-all active:scale-[0.96] hover:bg-white/[0.08] group"
    >
      <div
        className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg transition-transform group-hover:scale-110`}
      >
        <Icon size={16} className="text-white" />
      </div>
      <span className="text-[11px] font-bold text-white/60">{label}</span>
    </button>
  );
}

/* ── 4. Next Event Card ───────────────────────────────────────── */
function NextEventCard({
  type,
  date,
  status,
}: {
  type: string;
  date: string;
  status: string;
}) {
  const isApproved = status === 'APPROVED';
  const isPending = status === 'PENDING';

  const statusLabel = getStatusLabel(status);
  const statusBadgeColor = isApproved
    ? 'bg-green-500/20 text-green-400'
    : isPending
      ? 'bg-amber-500/20 text-amber-400'
      : 'bg-red-500/20 text-red-400';

  return (
    <section className="glass-strong rounded-card-lg p-4 animate-slideUp">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-500/15 text-green-400">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{type}</p>
            <p className="mt-0.5 text-xs font-semibold text-white/40">
              {formatDate(date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${statusBadgeColor}`}>
            {statusLabel}
          </span>
          <span className="flex items-center gap-1 text-xs font-bold text-white/30">
            {daysUntil(date)}
            <ChevronRight size={14} className="text-white/20" />
          </span>
        </div>
      </div>
    </section>
  );
}

/* ── 5. Requests Mini KPI Card ────────────────────────────────── */
function RequestsMiniCard({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color: 'amber' | 'green' | 'red' | 'blue';
  onClick: () => void;
}) {
  const dotColorMap = {
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-strong rounded-card-lg p-3 flex flex-col items-center gap-1.5 transition-all hover:bg-white/[0.08] active:scale-[0.97]"
    >
      <span className={`h-2 w-2 rounded-full ${dotColorMap[color]}`} />
      <span className="text-lg font-black text-white">{value}</span>
      <span className="text-[10px] font-bold text-white/40">{label}</span>
    </button>
  );
}

/* ── 6. Legend Dot ────────────────────────────────────────────── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] font-semibold text-white/30">{label}</span>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="grid gap-4 pb-4">
      {/* Profile skeleton */}
      <section className="glass-strong rounded-card-lg p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </section>

      {/* Balance skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-card-lg" />
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-card-lg" />
        ))}
      </div>

      {/* Event skeleton */}
      <Skeleton className="h-[68px] rounded-card-lg" />

      {/* Requests skeleton */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-card-lg" />
        ))}
      </div>

      {/* Calendar skeleton */}
      <Skeleton className="h-56 rounded-card-lg" />
    </div>
  );
}
