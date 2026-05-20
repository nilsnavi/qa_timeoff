import { CalendarDays, Clock3, Plane, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BalanceSummary } from '../components/balance/BalanceSummary';
import { Badge, Card } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';

export function HomePage() {
  const { dashboard } = useDashboard();
  const user = dashboard.user;
  const events = [
    ...dashboard.requests.map((request) => ({
      id: request.id,
      title: 'Time off',
      date: request.date,
      meta: `${request.hours} h`,
      status: request.status,
    })),
    ...(dashboard.vacations ?? []).map((request) => ({
      id: request.id,
      title: 'Vacation',
      date: request.startDate,
      meta: `${request.daysCount} d`,
      status: request.status,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const operations = dashboard.operations.slice(0, 3);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[28px] app-gradient text-xl font-black text-white shadow-lg shadow-blue-500/25">
            {getInitials(user.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Hello</p>
            <h2 className="truncate text-2xl font-black text-slate-950 dark:text-white">{user.fullName}</h2>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="gradient">{user.role}</Badge>
              <span className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">{user.position ?? 'QA Team'}</span>
            </div>
          </div>
          <UserRound className="text-blue-500" size={26} />
        </div>
      </Card>

      <BalanceSummary balance={dashboard.balance} />

      <section className="grid gap-3">
        <h2 className="px-1 text-lg font-black text-slate-950 dark:text-white">Quick actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction to="/timeoff/new" label="Time off" icon={Clock3} tone="primary" />
          <QuickAction to="/vacation/new" label="Vacation" icon={Plane} tone="light" />
          <QuickAction to="/calendar" label="Calendar" icon={CalendarDays} tone="light" />
        </div>
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Upcoming</h2>
          <Sparkles className="text-violet-500" size={20} />
        </div>
        <div className="grid gap-2">
          {events.length === 0 && <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No events</p>}
          {events.map((event) => (
            <div key={`${event.title}-${event.id}`} className="flex items-center justify-between rounded-[20px] bg-white/65 p-3 dark:bg-slate-900/60">
              <div>
                <p className="font-black text-slate-900 dark:text-white">{event.title}</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {event.date} · {event.meta}
                </p>
              </div>
              <Badge tone={event.status === 'APPROVED' ? 'success' : 'warning'}>{event.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-black text-slate-950 dark:text-white">Recent operations</h2>
        <div className="grid gap-2">
          {operations.length === 0 && <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No operations</p>}
          {operations.map((operation) => (
            <div key={operation.id} className="flex items-center justify-between rounded-[20px] bg-white/65 p-3 dark:bg-slate-900/60">
              <div>
                <p className="font-black text-slate-900 dark:text-white">{operation.reason}</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{operation.operationType}</p>
              </div>
              <span className={`text-xl font-black ${operation.hours > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {operation.hours > 0 ? '+' : ''}
                {operation.hours}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function QuickAction({
  to,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  icon: typeof Clock3;
  tone: 'primary' | 'light';
}) {
  return (
    <Link
      to={to}
      className={`grid min-h-24 place-items-center gap-2 rounded-[24px] p-3 text-center text-sm font-black shadow-soft transition active:scale-[0.98] ${
        tone === 'primary'
          ? 'app-gradient text-white'
          : 'bg-white/75 text-slate-800 ring-1 ring-white/70 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-slate-700'
      }`}
    >
      <Icon size={26} />
      <span>{label}</span>
    </Link>
  );
}

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
