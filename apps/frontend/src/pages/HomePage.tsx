import {
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock3,
  History,
  MoreHorizontal,
  Plane,
  Plus,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ErrorState, Skeleton } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';
import { getRoleLabel, getStatusLabel } from '../shared/utils';

// ─── Constants ──────────────────────────────────────────────────────────
const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// ─── Helpers ────────────────────────────────────────────────────────────
function getInitials(fn: string) {
  return fn.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }

function getFirstDayOffset(y: number, m: number) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function formatDate(date: string) {
  const d = new Date(date);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} (${WEEKDAYS[d.getDay()]})`;
}

function daysUntil(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'Прошло';
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  return `Через ${diff} дн.`;
}

function isWeekend(y: number, m: number, day: number) {
  const d = new Date(y, m, day).getDay();
  return d === 0 || d === 6;
}

// ─── Main Component ─────────────────────────────────────────────────────
export function HomePage() {
  const { dashboard, data, isError, isLoading, refetch } = useDashboard();
  const navigate = useNavigate();

  // Calendar state (must be before early returns)
  const today = new Date();
  const [calYear] = useState(today.getFullYear());
  const [calMonth] = useState(today.getMonth());

  if (isError && !data) {
    return <ErrorState title="Главный экран не загрузился" description="Не удалось получить баланс, события и операции." onRetry={() => refetch()} />;
  }

  if (isLoading && !data) {
    return <HomeSkeleton />;
  }

  const user = dashboard.user;
  const balance = dashboard.balance;
  const isAdmin = user.role === 'ADMIN';

  // ── Next event ──────────────────────────────────────────────────
  const allEvents = [
    ...dashboard.requests.map((r) => ({ id: r.id, type: 'Отгул' as const, date: r.date, status: r.status })),
    ...(dashboard.vacations ?? []).map((v) => ({ id: v.id, type: 'Отпуск' as const, date: v.startDate, status: v.status })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = allEvents.find((e) => new Date(e.date) >= new Date()) ?? null;

  // ── Requests summary ────────────────────────────────────────────
  const allReq = [
    ...dashboard.requests.map((r) => r.status),
    ...(dashboard.vacations ?? []).map((v) => v.status),
  ];
  const pendingCount = allReq.filter((s) => s === 'PENDING').length;
  const approvedCount = allReq.filter((s) => s === 'APPROVED').length;
  const rejectedCount = allReq.filter((s) => s === 'REJECTED').length;
  const totalCount = allReq.length;

  // ── Calendar data ───────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOffset = getFirstDayOffset(calYear, calMonth);
  const isCurrentMonth = today.getMonth() === calMonth && today.getFullYear() === calYear;

  const eventDates = new Set<string>();
  for (const r of dashboard.requests) eventDates.add(r.date);
  for (const v of dashboard.vacations ?? []) {
    for (let d = new Date(v.startDate); d <= new Date(v.endDate); d.setDate(d.getDate() + 1)) {
      eventDates.add(d.toISOString().slice(0, 10));
    }
  }

  // ── Notifications ───────────────────────────────────────────────
  const recentNotifications = dashboard.notifications.slice(0, 3);

  // ── Compact profile data ────────────────────────────────────────
  const initials = getInitials(user.fullName);

  return (
    <div className="dashboard-grid">
      {/* ═══ LEFT COLUMN (70%) ═══ */}
      <div className="flex flex-col gap-3">

        {/* ── Mini Profile Strip ─────────────────────────────── */}
        <div className="enterprise-card flex items-center gap-3 p-3">
          <div className="relative shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-[10px] app-gradient text-[11px] font-bold text-white shadow-sm">
              {initials}
            </div>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111A2E] bg-emerald-500" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{user.fullName}</span>
                <Badge tone="gradient" className="text-[9px]">{getRoleLabel(user.role)}</Badge>
              </div>
              <span className="text-[11px] font-medium text-white/40">{user.position ?? 'QA-команда'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
                title="Администрирование"
              >
                <UserPlus size={14} />
              </button>
            )}
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-colors"
              title="Ещё"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* ── Compact KPI Tiles (3 in a row) ─────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <KpiTile
            label="Доступно"
            value={`${balance.balanceHours} ч`}
            progress={balance.totalAddedHours > 0 ? balance.balanceHours / balance.totalAddedHours : 0}
            color="emerald"
          />
          <KpiTile
            label="Начислено"
            value={`${balance.totalAddedHours} ч`}
            progress={1}
            color="blue"
          />
          <KpiTile
            label="Использовано"
            value={`${balance.totalUsedHours} ч`}
            progress={balance.totalAddedHours > 0 ? balance.totalUsedHours / balance.totalAddedHours : 0}
            color="violet"
          />
        </div>

        {/* ── Quick Actions Horizontal Row ──────────────────── */}
        <div className="quick-actions-row">
          <QuickActionBtn icon={Clock3} label="Отгул" color="from-blue-500 to-blue-600" onClick={() => navigate('/timeoff/new')} />
          <QuickActionBtn icon={Plane} label="Отпуск" color="from-violet-500 to-purple-600" onClick={() => navigate('/vacation/new')} />
          <QuickActionBtn icon={CalendarDays} label="Календарь" color="from-emerald-500 to-teal-600" onClick={() => navigate('/calendar')} />
          <QuickActionBtn icon={History} label="История" color="from-amber-500 to-orange-600" onClick={() => navigate('/requests')} />
          <QuickActionBtn icon={Plus} label="Создать" color="from-[#4C7DFF] to-[#7C5CFF]" onClick={() => navigate('/timeoff/new')} />
        </div>

        {/* ── Mini Calendar ─────────────────────────────────── */}
        <div className="enterprise-card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80">{MONTHS_RU[calMonth]} {calYear}</span>
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/40">Месяц</span>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[9px] font-semibold text-white/30">
            {DAYS_SHORT.map((d) => (<span key={d} className="py-0.5">{d}</span>))}
          </div>
          <div className="grid grid-cols-7 text-center">
            {Array.from({ length: firstDayOffset }).map((_, i) => (<div key={`o-${i}`} className="py-0.5" />))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isTd = isCurrentMonth && day === today.getDate();
              const hasE = eventDates.has(ds);
              const isWk = isWeekend(calYear, calMonth, day);
              let dot = '';
              if (hasE) dot = 'bg-blue-900/400';
              else if (isWk) dot = 'bg-red-500/60';
              return (
                <button key={day} type="button"
                  className={`relative flex flex-col items-center justify-center rounded-md py-1 text-xs font-medium transition-colors hover:bg-white/[0.04] ${
                    isTd ? 'bg-[#4C7DFF]/20 text-[#4C7DFF] font-bold' : 'text-white/60'
                  }`}
                >
                  <span>{day}</span>
                  {dot && <span className={`mt-0.5 h-1 w-1 rounded-full ${dot}`} />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-3 border-t border-white/[0.04] pt-2">
            <LegendDot color="bg-emerald-500" label="Доступен" />
            <LegendDot color="bg-blue-900/400" label="Заявка" />
            <LegendDot color="bg-red-500/60" label="Выходной" />
            <LegendDot color="bg-yellow-500" label="Праздник" />
          </div>
        </div>
      </div>

      {/* ═══ RIGHT COLUMN (30%) ═══ */}
      <div className="flex flex-col gap-3">

        {/* ── Next Event ────────────────────────────────────── */}
        {nextEvent ? (
          <div className="enterprise-card p-3.5 hover-lift">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Ближайшее событие</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Calendar size={14} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{nextEvent.type}</div>
                  <div className="text-[10px] text-white/40">{formatDate(nextEvent.date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <EventStatusBadge status={nextEvent.status} />
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-white/30">
                  {daysUntil(nextEvent.date)}
                  <ChevronRight size={10} />
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="enterprise-card p-3.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">Ближайшее событие</div>
            <p className="text-xs text-white/40">Нет предстоящих событий</p>
          </div>
        )}

        {/* ── Requests Summary ──────────────────────────────── */}
        <div className="enterprise-card p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Статистика заявок</span>
            <button
              type="button"
              onClick={() => navigate('/requests')}
              className="text-[10px] font-semibold text-[#4C7DFF] hover:text-[#6B96FF] transition-colors"
            >
              Все →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatBadge label="Ожидают" value={pendingCount} color="bg-amber-500" />
            <StatBadge label="Одобрены" value={approvedCount} color="bg-emerald-500" />
            <StatBadge label="Отклонены" value={rejectedCount} color="bg-rose-950/300" />
            <StatBadge label="Всего" value={totalCount} color="bg-[#4C7DFF]" />
          </div>
        </div>

        {/* ── Notifications Feed ────────────────────────────── */}
        <div className="enterprise-card p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Уведомления</span>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="text-[10px] font-semibold text-[#4C7DFF] hover:text-[#6B96FF] transition-colors"
            >
              Все →
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {recentNotifications.length === 0 && (
              <p className="text-xs text-white/40">Нет уведомлений</p>
            )}
            {recentNotifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => navigate('/notifications')}
                className="flex items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.isRead ? 'bg-white/10' : 'bg-[#4C7DFF]'}`} />
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-white/80">{n.title}</div>
                  <div className="truncate text-[10px] text-white/40">{n.message}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Admin Quick Actions (visible only for admin) ─── */}
        {isAdmin && (
          <div className="enterprise-card p-3.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Админ-панель</div>
            <div className="grid grid-cols-2 gap-1.5">
              <AdminBtn label="+ Переработка" onClick={() => navigate('/admin')} />
              <AdminBtn label="Назначить роль" onClick={() => navigate('/admin')} />
              <AdminBtn label="KPI отчёт" onClick={() => navigate('/admin')} />
              <AdminBtn label="Сотрудники" onClick={() => navigate('/admin')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

/* KPI Tile */
function KpiTile({ label, value, progress, color }: { label: string; value: string; progress: number; color: 'emerald' | 'blue' | 'violet' }) {
  const barColor = { emerald: 'bg-emerald-500', blue: 'bg-[#4C7DFF]', violet: 'bg-violet-500' }[color];
  return (
    <div className="enterprise-card flex flex-col justify-between p-3 min-h-[64px] hover-lift">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <div>
        <span className="text-base font-bold text-white">{value}</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${barColor} progress-fill`} style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </div>
    </div>
  );
}

/* Quick Action Button (80×80 card, icon top + label bottom) */
function QuickActionBtn({ icon: Icon, label, color, onClick }: { icon: React.ElementType; label: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="quick-action-btn enterprise-card flex flex-col items-center justify-center gap-2 transition-all active:scale-95 hover-lift group"
    >
      <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${color} shadow-sm transition-transform group-hover:scale-110`}>
        <Icon size={16} className="text-white" />
      </div>
      <span className="text-[10px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">{label}</span>
    </button>
  );
}

/* Event Status Badge (small) */
function EventStatusBadge({ status }: { status: string }) {
  const isApproved = status === 'APPROVED';
  const isPending = status === 'PENDING';
  const color = isApproved ? 'bg-emerald-500/15 text-emerald-400' : isPending ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-950/300/15 text-rose-400';
  return <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${color}`}>{getStatusLabel(status)}</span>;
}

/* Stat Badge */
function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <div>
        <div className="text-xs font-bold text-white">{value}</div>
        <div className="text-[9px] font-medium text-white/40">{label}</div>
      </div>
    </div>
  );
}

/* Admin Button */
function AdminBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white/80 active:scale-95"
    >
      {label}
    </button>
  );
}

/* Legend Dot */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-[8px] font-medium text-white/30">{label}</span>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────
function HomeSkeleton() {
  return (
    <div className="dashboard-grid">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[56px] rounded-[12px]" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[64px] rounded-[12px]" />)}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[64px] w-[64px] rounded-[12px]" />)}
        </div>
        <Skeleton className="h-[200px] rounded-[12px]" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[64px] rounded-[12px]" />
        <Skeleton className="h-[96px] rounded-[12px]" />
        <Skeleton className="h-[144px] rounded-[12px]" />
      </div>
    </div>
  );
}
