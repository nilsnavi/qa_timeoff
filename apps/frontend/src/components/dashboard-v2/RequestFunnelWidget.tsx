import { Filter } from 'lucide-react';
import type { RequestFunnel } from '../../shared/types';

const stages = [
  { key: 'draft' as const, label: 'Черновик', color: 'bg-white/20' },
  { key: 'pending' as const, label: 'На согласовании', color: 'bg-amber-500' },
  { key: 'approved' as const, label: 'Одобрено', color: 'bg-emerald-500' },
  { key: 'rejected' as const, label: 'Отклонено', color: 'bg-rose-500' },
  { key: 'cancelled' as const, label: 'Отменено', color: 'bg-white/10' },
];

export function RequestFunnelWidget({ funnel }: { funnel: RequestFunnel }) {
  const total = funnel.draft + funnel.pending + funnel.approved + funnel.rejected + funnel.cancelled;

  if (total === 0) {
    return (
      <div className="enterprise-card p-4">
        <h3 className="text-[14px] font-bold text-white flex items-center gap-2 mb-3">
          <Filter size={16} className="text-blue-400" />
          Воронка заявок за месяц
        </h3>
        <div className="rounded-lg bg-white/[0.02] p-4 text-center">
          <p className="text-[13px] text-white/40">Нет заявок за текущий месяц</p>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-card p-4">
      <h3 className="text-[14px] font-bold text-white flex items-center gap-2 mb-3">
        <Filter size={16} className="text-blue-400" />
        Воронка заявок за месяц
      </h3>
      <div className="space-y-2.5">
        {stages.map((stage) => {
          const count = funnel[stage.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-white/60">{stage.label}</span>
                <span className="font-bold text-white/80">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="pt-1 text-[12px] text-white/30 text-right">Всего: {total}</div>
      </div>
    </div>
  );
}
