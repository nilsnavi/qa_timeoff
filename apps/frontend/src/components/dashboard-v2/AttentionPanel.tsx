import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AttentionItem } from '../../shared/types';

const severityConfig = {
  SUCCESS: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  CRITICAL: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
};

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const navigate = useNavigate();

  if (!items.length) return null;

  return (
    <div className="enterprise-card p-4">
      <h3 className="text-[14px] font-bold text-white mb-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-amber-400" />
        Что требует внимания
      </h3>
      <div className="space-y-2">
        {items.map((item, i) => {
          const cfg = severityConfig[item.severity] ?? severityConfig.INFO;
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2.5`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon size={15} className={`shrink-0 ${cfg.color}`} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white/80 truncate">{item.title}</p>
                  <p className="text-[12px] text-white/40 truncate">{item.description}</p>
                </div>
              </div>
              {item.actionLabel && item.actionUrl && (
                <button
                  type="button"
                  onClick={() => navigate(item.actionUrl!)}
                  className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors"
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
