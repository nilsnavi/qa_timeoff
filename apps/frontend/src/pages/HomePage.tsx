import { ErrorState } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';
import { WorkStatusCard } from '../components/dashboard-v2/WorkStatusCard';
import { CalendarWidget } from '../components/dashboard-v2/CalendarWidget';
import { NextEventsWidget } from '../components/dashboard-v2/NextEventsWidget';
import { QuickActionsWidget } from '../components/dashboard-v2/QuickActionsWidget';
import { BalanceProgressWidget } from '../components/dashboard-v2/BalanceProgressWidget';
import { AnalyticsSnapshot } from '../components/dashboard-v2/AnalyticsSnapshot';
import { WorkFeed } from '../components/dashboard-v2/WorkFeed';
import { ProcessFunnel } from '../components/dashboard-v2/ProcessFunnel';
import { TeamWorkload } from '../components/dashboard-v2/TeamWorkload';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();
  const { dashboard, data, isError, isLoading, refetch } = useDashboard();

  if (isError && !data) {
    return <ErrorState title="Не удалось загрузить дашборд" description="Не удалось получить данные." onRetry={() => refetch()} />;
  }

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  const user = dashboard.user;
  const isManager = user.role === 'MANAGER' || user.role === 'LEAD' || user.role === 'ADMIN';

  const hasDraftTimeOff = !!localStorage.getItem('draft-timeoff');
  const hasDraftVacation = !!localStorage.getItem('draft-vacation');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Дашборд</h1>
        <p className="text-[15px] text-white/40 mt-1">
          С возвращением, {user.fullName}. {isManager ? 'Обзор команды и процессов.' : 'Обзор рабочей активности.'}
        </p>
      </div>

      {hasDraftTimeOff && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-400">Есть незаконченная заявка на отгул</span>
          <button onClick={() => navigate('/timeoff/new')} className="text-xs text-amber-400 underline">Продолжить</button>
        </div>
      )}

      {hasDraftVacation && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-400">Есть незаконченная заявка на отпуск</span>
          <button onClick={() => navigate('/vacation/new')} className="text-xs text-amber-400 underline">Продолжить</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <WorkStatusCard dashboard={dashboard} />
          <CalendarWidget dashboard={dashboard} />
          {isManager && <ProcessFunnel dashboard={dashboard} />}
        </div>
        <div className="space-y-6">
          <QuickActionsWidget dashboard={dashboard} />
          <BalanceProgressWidget dashboard={dashboard} />
          <NextEventsWidget dashboard={dashboard} />
          <AnalyticsSnapshot dashboard={dashboard} />
          {isManager && <TeamWorkload dashboard={dashboard} />}
          <WorkFeed notifications={dashboard.notifications} />
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-36 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-white/[0.03] animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-[280px] rounded-xl bg-white/[0.02] animate-pulse" />
          <div className="h-[360px] rounded-xl bg-white/[0.02] animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-[200px] rounded-xl bg-white/[0.02] animate-pulse" />
          <div className="h-[300px] rounded-xl bg-white/[0.02] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
