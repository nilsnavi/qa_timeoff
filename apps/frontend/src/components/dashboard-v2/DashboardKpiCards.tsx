import { Clock3, FileText, Users, UserCheck, AlertTriangle } from 'lucide-react';
import type { DashboardSummary } from '../../shared/types';
import { useAuth } from '../../shared/auth/AuthContext';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  detail: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function KpiCard({ title, value, subtitle, detail, icon: Icon, color, bgColor }: KpiCardProps) {
  return (
    <div className="enterprise-card p-4 hover-lift flex flex-col justify-between min-h-[150px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-white/50">{title}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${bgColor}`}>
          <Icon size={16} className={color} />
        </span>
      </div>
      <div>
        <span className="text-[30px] font-bold text-white leading-tight">{value}</span>
        <p className="text-[13px] text-white/40 mt-0.5">{subtitle}</p>
        <p className="text-[12px] text-white/30 mt-1.5">{detail}</p>
      </div>
    </div>
  );
}

export function DashboardKpiCards({ dashboard }: { dashboard: DashboardSummary }) {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isLead = user?.role === 'LEAD';
  const canViewTeam = isManager || isLead;

  const { balance, requests, team } = dashboard;

  const riskColors: Record<string, { color: string; bgColor: string }> = {
    LOW: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    MEDIUM: { color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    HIGH: { color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    CRITICAL: { color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
  };

  const riskStyle = riskColors[team.riskLevel] ?? riskColors.LOW;

  const cards: KpiCardProps[] = [
    {
      title: 'Мой баланс',
      value: `${balance.availableHours} ч`,
      subtitle: `Использовано: ${balance.usedHours} ч из ${balance.totalHours} ч`,
      detail: `${balance.usedPercent}%`,
      icon: Clock3,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Мои заявки',
      value: String(requests.myPending),
      subtitle: 'ожидают решения',
      detail: `${requests.myApprovedThisMonth} одобрено в этом месяце`,
      icon: FileText,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
    },
    ...(canViewTeam
      ? [{
          title: 'Требуют согласования',
          value: String(requests.pendingApprovalCount),
          subtitle: 'заявок',
          detail: `${requests.pendingApprovalHours} ч всего`,
          icon: Users,
          color: 'text-amber-400' as const,
          bgColor: 'bg-amber-500/10',
        }]
      : []),
    {
      title: 'Сегодня отсутствуют',
      value: String(team.absentToday),
      subtitle: 'сотрудника',
      detail:
        team.absentToday > 0
          ? Object.entries(team.absenceByType)
              .map(([type, count]) => `${type === 'VACATION' ? 'отпуск' : 'отгул'} ${count}`)
              .join(', ') || '—'
          : 'Все на месте',
      icon: UserCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Риск перегруза',
      value: team.riskLevel === 'LOW' ? 'Низкий' : team.riskLevel === 'MEDIUM' ? 'Средний' : team.riskLevel === 'HIGH' ? 'Высокий' : 'Критический',
      subtitle: team.overloadedEmployees > 0
        ? `${team.overloadedEmployees} сотрудников в критической зоне`
        : 'Нет перегруженных',
      detail: `Доступность: ${team.availabilityPercent}%`,
      icon: AlertTriangle,
      color: riskStyle.color,
      bgColor: riskStyle.bgColor,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
}
