import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import type { Dashboard } from '../../shared/types';

export function AnalyticsSnapshot({ dashboard }: { dashboard: Dashboard }) {
  const reqs = dashboard.requests;
  const vacs = dashboard.vacations ?? [];
  const all = [...reqs, ...vacs];
  const approved = all.filter(r => r.status === 'APPROVED').length;
  const rejected = all.filter(r => r.status === 'REJECTED').length;
  const total = all.length;
  const approvalRate = total > 0 ? Math.round((approved / (approved + rejected || 1)) * 100) : 0;

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthReq = all.filter(r => {
    const d = new Date('date' in r ? r.date : r.startDate);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  return (
    <div className="enterprise-card p-5 hover-lift">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={14} className="text-white/25" />
        <p className="text-[13px] font-bold uppercase tracking-widest text-white/25">Аналитика</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/30 mb-1">Одобрение</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white">{approvalRate}%</span>
            <span className={`flex items-center text-[13px] font-semibold ${approvalRate > 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {approvalRate > 70 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
          </div>
          <p className="text-[12px] text-white/25 mt-1">{approved} одобр / {rejected} откл</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/30 mb-1">За месяц</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white">{monthReq}</span>
            <span className="text-[13px] font-semibold text-white/30">заявок</span>
          </div>
          <p className="text-[12px] text-white/25 mt-1">Всего {total} за год</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/30 mb-1">Ожидают</p>
          <span className="text-2xl font-bold text-amber-400">{all.filter(r => r.status === 'PENDING').length}</span>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/30 mb-1">Команда</p>
          <span className="text-2xl font-bold text-white">{new Set(reqs.map(r => ('user' in r ? (r as any).user?.id : '')).filter(Boolean)).size || 1}</span>
        </div>
      </div>
    </div>
  );
}
