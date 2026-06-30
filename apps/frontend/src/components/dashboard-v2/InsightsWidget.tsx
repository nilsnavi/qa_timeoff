import { Lightbulb, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { InsightItem } from '../../shared/types';
import { clsx } from 'clsx';

const severityConfig = {
  SUCCESS: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/15' },
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/15' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/15' },
};

export function InsightsWidget({ insights }: { insights: InsightItem[] }) {
  if (!insights.length) return null;

  return (
    <div className="enterprise-card p-4">
      <h3 className="text-[14px] font-bold text-white flex items-center gap-2 mb-3">
        <Lightbulb size={16} className="text-amber-400" />
        Инсайты системы
      </h3>
      <div className="space-y-2">
        {insights.map((item, i) => {
          const cfg = severityConfig[item.severity] ?? severityConfig.INFO;
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className={clsx('flex items-start gap-3 rounded-lg border p-3', cfg.bg, cfg.border)}
            >
              <Icon size={15} className={clsx('shrink-0 mt-0.5', cfg.color)} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white/80">{item.title}</p>
                <p className="text-[12px] text-white/40 mt-0.5">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
