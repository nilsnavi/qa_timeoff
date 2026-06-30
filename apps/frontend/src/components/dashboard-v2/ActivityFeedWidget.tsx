import { Activity, CheckCircle2, XCircle, Clock, AlertTriangle, Info } from 'lucide-react';
import type { ActivityItem } from '../../shared/types';
import { clsx } from 'clsx';

const severityIcons: Record<string, React.ElementType> = {
  SUCCESS: CheckCircle2,
  ERROR: XCircle,
  WARNING: AlertTriangle,
  INFO: Info,
};

const severityColors: Record<string, string> = {
  SUCCESS: 'text-emerald-400',
  ERROR: 'text-rose-400',
  WARNING: 'text-amber-400',
  INFO: 'text-blue-400',
};

const actionIcons: Record<string, React.ElementType> = {
  REQUEST_APPROVED: CheckCircle2,
  REQUEST_REJECTED: XCircle,
  REQUEST_CREATED: Clock,
  BALANCE_CHANGED: Activity,
  USER_UPDATED: Info,
};

export function ActivityFeedWidget({ activity }: { activity: ActivityItem[] }) {
  return (
    <div className="enterprise-card p-4">
      <h3 className="text-[14px] font-bold text-white flex items-center gap-2 mb-3">
        <Activity size={16} className="text-violet-400" />
        Последняя активность
      </h3>

      {activity.length === 0 ? (
        <div className="rounded-lg bg-white/[0.02] p-4 text-center">
          <p className="text-[13px] text-white/40">Нет активности за выбранный период</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.slice(0, 10).map((item, i) => {
            const Icon = actionIcons[item.type] ?? severityIcons[item.severity] ?? Info;
            const color = severityColors[item.severity] ?? 'text-blue-400';
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5"
              >
                <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06]', color)}>
                  <Icon size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white/70 truncate">{item.title}</p>
                  <p className="text-[12px] text-white/40 truncate">{item.description}</p>
                </div>
                <span className="shrink-0 text-[11px] text-white/30">{item.timeAgo}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
