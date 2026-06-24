import { AlertCircle, CheckCircle2, Clock3, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type { Dashboard } from '../../shared/types';
import { useNavigate } from 'react-router-dom';

type Status = 'ACTIVE' | 'ON_LEAVE' | 'OVERLOADED' | 'AT_RISK';

const statusConfig: Record<Status, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  ACTIVE: { icon: CheckCircle2, label: 'Активен', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ON_LEAVE: { icon: Clock3, label: 'В отпуске', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  OVERLOADED: { icon: Zap, label: 'Перегружен', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  AT_RISK: { icon: AlertCircle, label: 'Риск', color: 'text-rose-400', bg: 'bg-rose-950/300/10' },
};

function computeStatus(d: Dashboard): Status {
  const pending = d.requests.filter(r => r.status === 'PENDING').length + (d.vacations ?? []).filter(v => v.status === 'PENDING').length;
  const approved = d.requests.filter(r => r.status === 'APPROVED').length + (d.vacations ?? []).filter(v => v.status === 'APPROVED').length;
  const balanceRatio = d.balance.totalAddedHours > 0 ? d.balance.balanceHours / d.balance.totalAddedHours : 0;

  if (approved > 0 && balanceRatio < 0.2) return 'AT_RISK';
  if (pending > 5) return 'OVERLOADED';
  if (approved > 0) return 'ON_LEAVE';
  return 'ACTIVE';
}

export function WorkStatusCard({ dashboard }: { dashboard: Dashboard }) {
  const navigate = useNavigate();
  const status = computeStatus(dashboard);
  const config = statusConfig[status];
  const Icon = config.icon;
  const { balance } = dashboard;
  const balanceRatio = balance.totalAddedHours > 0 ? balance.balanceHours / balance.totalAddedHours : 0;
  const pendingCount = dashboard.requests.filter(r => r.status === 'PENDING').length + (dashboard.vacations ?? []).filter(v => v.status === 'PENDING').length;
  const approvedCount = dashboard.requests.filter(r => r.status === 'APPROVED').length + (dashboard.vacations ?? []).filter(v => v.status === 'APPROVED').length;

  return (
    <div className="enterprise-card p-5 hover-lift">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-1">Статус</p>
          <h2 className="text-2xl font-bold text-white">{dashboard.user.fullName.split(' ')[0]}</h2>
          <p className="text-[13px] text-white/40 mt-0.5">{dashboard.user.position || 'Сотрудник'}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${config.color} ${config.bg}`}>
          <Icon size={12} />
          {config.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Доступно</span>
            {balanceRatio < 0.3 ? <TrendingDown size={12} className="text-rose-400" /> : <TrendingUp size={12} className="text-emerald-400" />}
          </div>
          <span className="text-xl font-bold text-white">{balance.balanceHours}ч</span>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full progress-fill ${balanceRatio < 0.3 ? 'bg-rose-950/300' : 'bg-emerald-500'}`} style={{ width: `${Math.min(balanceRatio * 100, 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-white/25">
            <span>Исп: {balance.totalUsedHours}ч</span>
            <span>Всего: {balance.totalAddedHours}ч</span>
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">Заявки</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50">Ожидают</span>
              <span className="text-sm font-bold text-amber-400">{pendingCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50">Одобрено</span>
              <span className="text-sm font-bold text-emerald-400">{approvedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => navigate('/timeoff/new')} className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors">
          + Отгул
        </button>
        <button onClick={() => navigate('/vacation/new')} className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors">
          + Отпуск
        </button>
      </div>
    </div>
  );
}
