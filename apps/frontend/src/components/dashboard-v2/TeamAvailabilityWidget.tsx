import { BarChart3 } from 'lucide-react';
import type { TeamAvailabilityDay } from '../../shared/types';
import { clsx } from 'clsx';

const barColors = {
  NORMAL: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
};

export function TeamAvailabilityWidget({ days }: { days: TeamAvailabilityDay[] }) {
  if (!days.length) return null;

  return (
    <div className="enterprise-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
          <BarChart3 size={16} className="text-violet-400" />
          Командная доступность
        </h3>
        <span className="text-[12px] font-semibold text-white/40">Неделя</span>
      </div>

      <div className="space-y-2.5">
        {days.map((day, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-white/50">{day.label}</span>
              <span className={clsx(
                'font-bold',
                day.availabilityPercent >= 70 ? 'text-emerald-400' : day.availabilityPercent >= 60 ? 'text-amber-400' : 'text-rose-400'
              )}>
                {day.availabilityPercent}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-500', barColors[day.status])}
                style={{ width: `${Math.min(day.availabilityPercent, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {days.some(d => d.availabilityPercent < 70) && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/15 px-3 py-2 text-[12px] font-medium text-amber-400">
          Доступность ниже 70% — возможно, требуется усиление
        </div>
      )}
    </div>
  );
}
