import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '../components/ui';
import { useDashboardSummary } from '../shared/hooks/useDashboard';
import { DashboardKpiCards } from '../components/dashboard-v2/DashboardKpiCards';
import { AttentionPanel } from '../components/dashboard-v2/AttentionPanel';
import { QuickActionsPanel } from '../components/dashboard-v2/QuickActionsPanel';
import { TeamCalendarWidget } from '../components/dashboard-v2/TeamCalendarWidget';
import { PendingApprovalsWidget } from '../components/dashboard-v2/PendingApprovalsWidget';
import { TeamAvailabilityWidget } from '../components/dashboard-v2/TeamAvailabilityWidget';
import { UpcomingEventsWidget } from '../components/dashboard-v2/UpcomingEventsWidget';
import { RequestFunnelWidget } from '../components/dashboard-v2/RequestFunnelWidget';
import { InsightsWidget } from '../components/dashboard-v2/InsightsWidget';
import { ActivityFeedWidget } from '../components/dashboard-v2/ActivityFeedWidget';
import { OnboardingWidget } from '../components/dashboard-v2/OnboardingWidget';
import { useAuth } from '../shared/auth/AuthContext';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { dashboard, isError, isLoading, refetch } = useDashboardSummary();

  if (isError && !dashboard) {
    return <ErrorState title="Не удалось загрузить дашборд" description="Не удалось получить данные." onRetry={() => refetch()} />;
  }

  if (isLoading && !dashboard) {
    return <DashboardSkeleton />;
  }

  const d = dashboard!;
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isLead = user?.role === 'LEAD';
  const canViewTeam = isManager || isLead;

  if (d.onboarding?.show) {
    return <OnboardingWidget onboarding={d.onboarding} profile={d.profile} />;
  }

  const today = new Date();
  const dateStr = `Сегодня, ${String(today.getDate()).padStart(2, '0')} ${today.toLocaleDateString('ru-RU', { month: 'long' })} ${today.getFullYear()}`;

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-white">
              Добрый день, {d.profile.shortName} <span className="inline-block">👋</span>
            </h1>
            <p className="text-[14px] text-white/40 mt-0.5">{d.greeting}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[14px] font-medium text-white/60">
            <span>{dateStr}</span>
          </div>
        </div>

        <DashboardKpiCards dashboard={d} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <AttentionPanel items={d.attention} />
            <QuickActionsPanel actions={d.quickActions} />
            <TeamCalendarWidget days={d.calendar} />
            <RequestFunnelWidget funnel={d.funnel} />
            <InsightsWidget insights={d.insights} />
            <ActivityFeedWidget activity={d.activity} />
          </div>
          <div className="space-y-5">
            {canViewTeam && <PendingApprovalsWidget approvals={d.pendingApprovals} />}
            <TeamAvailabilityWidget days={d.teamAvailability} />
            <UpcomingEventsWidget events={d.upcomingEvents} />
          </div>
        </div>
      </div>
      <FloatingCreateButton />
    </>
  );
}

function FloatingCreateButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/timeoff/new')}
      className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#4C7DFF] text-white shadow-lg shadow-[#4C7DFF]/30 hover:bg-[#3C6DE0] hover:shadow-xl hover:shadow-[#4C7DFF]/40 transition-all active:scale-95"
      title="Новый отгул"
    >
      <Plus size={24} />
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-7 w-60 rounded-lg bg-white/[0.04]" />
          <div className="h-4 w-80 rounded-lg bg-white/[0.03]" />
        </div>
        <div className="h-9 w-64 rounded-lg bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[160px] rounded-xl bg-white/[0.02]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="h-[200px] rounded-xl bg-white/[0.02]" />
          <div className="h-[140px] rounded-xl bg-white/[0.02]" />
          <div className="h-[360px] rounded-xl bg-white/[0.02]" />
        </div>
        <div className="space-y-5">
          <div className="h-[300px] rounded-xl bg-white/[0.02]" />
          <div className="h-[240px] rounded-xl bg-white/[0.02]" />
          <div className="h-[280px] rounded-xl bg-white/[0.02]" />
        </div>
      </div>
    </div>
  );
}
