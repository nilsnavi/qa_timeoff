import { clsx } from 'clsx';
import { AlertTriangle, CalendarCheck, Clock, FileText, Users } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accentClass: string;
  iconBgClass: string;
}

function KpiCard({ label, value, icon, accentClass, iconBgClass }: KpiCardProps) {
  return (
    <div
      className={clsx(
        'enterprise-card flex items-center gap-3.5 p-4 transition-colors duration-200',
        'hover:bg-white/[0.05] cursor-default',
      )}
    >
      <div
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]',
          iconBgClass,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#7A8599]">{label}</p>
        <p className={clsx('text-[18px] font-bold tracking-tight', accentClass)}>{value}</p>
      </div>
    </div>
  );
}

export interface BalanceSummary {
  totalEmployees: number;
  totalAvailableHours: number;
  totalPlannedHours: number;
  totalPendingHours: number;
  negativeBalanceCount: number;
}

export function BalanceSummaryCards({ summary }: { summary: BalanceSummary }) {
  const cards = [
    {
      label: 'Всего сотрудников',
      value: String(summary.totalEmployees),
      icon: <Users size={18} className="text-blue-400" />,
      accentClass: 'text-blue-400',
      iconBgClass: 'bg-blue-500/10',
    },
    {
      label: 'Доступно',
      value: `${summary.totalAvailableHours} ч`,
      icon: <CalendarCheck size={18} className="text-emerald-400" />,
      accentClass: 'text-emerald-400',
      iconBgClass: 'bg-emerald-500/10',
    },
    {
      label: 'Запланировано',
      value: `${summary.totalPlannedHours} ч`,
      icon: <FileText size={18} className="text-blue-400" />,
      accentClass: 'text-blue-400',
      iconBgClass: 'bg-blue-500/10',
    },
    {
      label: 'На согласовании',
      value: `${summary.totalPendingHours} ч`,
      icon: <Clock size={18} className="text-amber-400" />,
      accentClass: 'text-amber-400',
      iconBgClass: 'bg-amber-500/10',
    },
    {
      label: 'Отрицательный баланс',
      value: String(summary.negativeBalanceCount),
      icon: <AlertTriangle size={18} className="text-red-400" />,
      accentClass: 'text-red-400',
      iconBgClass: 'bg-red-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}

export function BalanceSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="enterprise-card flex items-center gap-3.5 p-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-[10px] bg-white/[0.04]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
            <div className="h-5 w-14 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
