import { TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Dashboard } from '../../shared/types';

export function BalanceProgressWidget({ dashboard }: { dashboard: Dashboard }) {
  const navigate = useNavigate();
  const { balance } = dashboard;
  const ratio = balance.totalAddedHours > 0 ? Math.min(balance.balanceHours / balance.totalAddedHours, 1) : 0;
  const usedRatio = balance.totalAddedHours > 0 ? Math.min(balance.totalUsedHours / balance.totalAddedHours, 1) : 0;
  const isLow = ratio < 0.3;
  const isCritical = ratio < 0.1;

  const color = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
  const bgColor = isCritical ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="enterprise-card p-6 hover-lift cursor-pointer" onClick={() => navigate('/balance')}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-white/50">Баланс часов</p>
        {isLow ? <TrendingDown size={16} className="text-rose-400" /> : <TrendingUp size={16} className="text-emerald-400" />}
      </div>

      <div className="mb-4">
        <span className="text-[40px] font-bold leading-none" style={{ color }}>{balance.balanceHours}</span>
        <span className="text-[18px] text-white/40 ml-1">ч</span>
        <p className="text-[13px] text-white/40 mt-1">доступно из {balance.totalAddedHours}ч</p>
      </div>

      <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all ${bgColor}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <p className="text-[13px] text-white/40 mb-0.5">Использовано</p>
          <p className="text-[16px] font-bold text-white/70">{balance.totalUsedHours}ч</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2">
          <p className="text-[13px] text-white/40 mb-0.5">Использовано %</p>
          <p className="text-[16px] font-bold text-white/70">{Math.round(usedRatio * 100)}%</p>
        </div>
      </div>

      {isCritical && (
        <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
          <p className="text-[13px] text-rose-400 font-semibold">Баланс критически мал — менее 10%</p>
        </div>
      )}
    </div>
  );
}
