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
    <div className="enterprise-card p-6 hover-lift">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-white/40" />
        <p className="text-[13px] font-semibold text-white/50">Аналитика</p>
      </div>

      <div className="rounded-xl bg-white/[0.05] p-4 mb-3">
        <p className="text-[13px] font-medium text-white/45 mb-1">Одобрение заявок</p>
        <div className="flex items-end gap-3">
          <span className="text-[32px] font-bold text-white leading-none">{approvalRate}%</span>
          <span className={`text-[14px] font-semibold mb-0.5 flex items-center gap-1 ${approvalRate > 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {approvalRate > 70 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {approvalRate > 70 ? 'хороший' : 'низкий'}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${approvalRate > 70 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${approvalRate}%` }} />
        </div>
        <p className="text-[13px] text-white/40 mt-1.5">{approved} одобр / {rejected} откл</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[0.04] p-3 text-center">
          <p className="text-[13px] text-white/45 mb-1">За месяц</p>
          <span className="text-[22px] font-bold text-white">{monthReq}</span>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3 text-center">
          <p className="text-[13px] text-white/45 mb-1">Ожидают</p>
          <span className="text-[22px] font-bold text-amber-400">{all.filter(r => r.status === 'PENDING').length}</span>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3 text-center">
          <p className="text-[13px] text-white/45 mb-1">В команде</p>
          <span className="text-[22px] font-bold text-white">{new Set(reqs.map(r => ('user' in r ? (r as any).user?.id : '')).filter(Boolean)).size || 1}</span>
        </div>
      </div>
    </div>
  );
}
