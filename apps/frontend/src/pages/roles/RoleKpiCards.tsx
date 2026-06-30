import { Shield, Users, UserPlus, UserX } from 'lucide-react';
import type { RoleKpi } from '../../shared/types';

export function RoleKpiCards({ kpi, loading }: { kpi?: RoleKpi; loading?: boolean }) {
  const kpiRows = [
    { label: 'Всего ролей', value: kpi?.totalRoles, icon: Shield, color: 'text-[#4C7DFF]', bg: 'bg-[#4C7DFF]/10' },
    { label: 'Системных', value: kpi?.systemRoles, icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Пользовательских', value: kpi?.customRoles, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'С ролью', value: kpi?.usersWithRoles, icon: UserPlus, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Без роли', value: kpi?.usersWithoutRoles, icon: UserX, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpiRows.map((row) => (
        <div key={row.label} className="enterprise-card p-4 hover-lift">
          <div className="flex items-center gap-2 mb-2">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${row.bg} ${row.color}`}>
              <row.icon size={14} />
            </div>
            <span className="text-[13px] font-semibold text-white/40">{row.label}</span>
          </div>
          <span className="text-2xl font-bold text-white">
            {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-white/[0.04]" /> : (row.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}
