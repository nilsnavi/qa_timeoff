import { ErrorState } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';
import { WorkStatusCard } from '../components/dashboard-v2/WorkStatusCard';
import { CalendarWidget } from '../components/dashboard-v2/CalendarWidget';
import { WorkFeed } from '../components/dashboard-v2/WorkFeed';
import { AnalyticsSnapshot } from '../components/dashboard-v2/AnalyticsSnapshot';
import { ProcessFunnel } from '../components/dashboard-v2/ProcessFunnel';
import { TeamWorkload } from '../components/dashboard-v2/TeamWorkload';

export function HomePage() {
  const { dashboard, data, isError, isLoading, refetch } = useDashboard();

  if (isError && !data) {
    return <ErrorState title="Не удалось загрузить дашборд" description="Не удалось получить данные." onRetry={() => refetch()} />;
  }

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  const user = dashboard.user;
  const isManager = user.role === 'MANAGER' || user.role === 'LEAD' || user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Дашборд</h1>
        <p className="text-[15px] text-white/40 mt-1">
          С возвращением, {user.fullName}. {isManager ? 'Обзор команды и процессов.' : 'Обзор рабочей активности.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          <WorkStatusCard dashboard={dashboard} />
          <CalendarWidget dashboard={dashboard} />
          {isManager && <ProcessFunnel dashboard={dashboard} />}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
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
