import { CheckCircle2, Clock3, Zap, AlertCircle } from 'lucide-react';
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
    <div className="enterprise-card p-6 hover-lift">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[13px] font-semibold text-white/50 mb-1">Статус</p>
          <h2 className="text-[26px] font-bold text-white">{dashboard.user.fullName.split(' ')[0]}</h2>
          <p className="text-[14px] text-white/40 mt-0.5">{dashboard.user.position || 'Сотрудник'}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-bold ${config.color} ${config.bg}`}>
          <Icon size={14} />
          {config.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-medium text-white/45">Доступно</span>
          </div>
          <span className="text-[28px] font-bold leading-tight text-white">{balance.balanceHours}ч</span>
          <div className="mt-2 h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${balanceRatio < 0.3 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(balanceRatio * 100, 100)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[13px] text-white/40">
            <span>Исп: {balance.totalUsedHours}ч</span>
            <span>Всего: {balance.totalAddedHours}ч</span>
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-4">
          <p className="text-[13px] font-medium text-white/45 mb-2">Заявки</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-white/50">Ожидают</span>
              <span className="text-[15px] font-bold text-amber-400">{pendingCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-white/50">Одобрено</span>
              <span className="text-[15px] font-bold text-emerald-400">{approvedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={() => navigate('/timeoff/new')} className="flex-1 rounded-xl bg-[#4C7DFF]/15 border border-[#4C7DFF]/25 px-4 py-3 text-[14px] font-semibold text-[#6B96FF] hover:bg-[#4C7DFF]/25 hover:border-[#4C7DFF]/40 transition-all">
          + Отгул
        </button>
        <button onClick={() => navigate('/vacation/new')} className="flex-1 rounded-xl bg-white/[0.05] border border-white/[0.08] px-4 py-3 text-[14px] font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-all">
          + Отпуск
        </button>
      </div>
    </div>
  );
}
