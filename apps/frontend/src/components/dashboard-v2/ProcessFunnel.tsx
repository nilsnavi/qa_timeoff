import type { Dashboard, RequestStatus } from '../../shared/types';

type FunnelStage = { label: string; status: RequestStatus[]; color: string; bg: string };

const stages: FunnelStage[] = [
  { label: 'Черновик', status: ['DRAFT'], color: 'text-white/30', bg: 'bg-white/[0.04]' },
  { label: 'На согласовании', status: ['PENDING'], color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { label: 'Одобрено', status: ['APPROVED'], color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Отклонено', status: ['REJECTED'], color: 'text-rose-400', bg: 'bg-rose-950/300/10' },
  { label: 'Отменено', status: ['CANCELLED'], color: 'text-white/20', bg: 'bg-white/[0.02]' },
];

export function ProcessFunnel({ dashboard }: { dashboard: Dashboard }) {
  const all = [...dashboard.requests, ...(dashboard.vacations ?? [])];
  const maxCount = Math.max(...stages.map(s => all.filter(r => s.status.includes(r.status)).length), 1);

  return (
    <div className="enterprise-card p-5">
      <p className="text-[13px] font-bold uppercase tracking-widest text-white/25 mb-4">Воронка заявок</p>
      <div className="space-y-2">
        {stages.map((stage) => {
          const count = all.filter(r => stage.status.includes(r.status)).length;
          const width = (count / maxCount) * 100;
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[14px] font-semibold text-white/50">{stage.label}</span>
              <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden">
                <div
                  className={`h-full rounded-md ${stage.bg} ${stage.color} flex items-center px-3 text-[13px] font-bold transition-all duration-500`}
                  style={{ width: `${width}%`, minWidth: count > 0 ? '40px' : '0' }}
                >
                  {count > 0 && count}
                </div>
              </div>
              <span className="w-8 text-right text-[14px] font-bold text-white/30">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
