import { Activity, CheckCircle2, XCircle, Clock, AlertTriangle, Info } from 'lucide-react';
import type { ActivityItem } from '../../shared/types';
import { clsx } from 'clsx';

const actionSeverity: Record<string, string> = {
  REQUEST_APPROVED: 'SUCCESS',
  APPROVE: 'SUCCESS',
  REQUEST_REJECTED: 'WARNING',
  REJECT: 'WARNING',
  REQUEST_CREATED: 'INFO',
  CREATE: 'INFO',
  BALANCE_CHANGED: 'INFO',
  USER_UPDATED: 'INFO',
  USER_DEACTIVATED: 'WARNING',
  USER_DELETED: 'ERROR',
  OVERTIME_ADDED: 'WARNING',
  OVERTIME_CANCELLED: 'INFO',
};

const severityConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  SUCCESS: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ERROR: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  INFO: { icon: Info, color: 'text-white/50', bg: 'bg-white/[0.06]' },
};

const actionIcons: Record<string, React.ElementType> = {
  REQUEST_APPROVED: CheckCircle2,
  REQUEST_REJECTED: XCircle,
  REQUEST_CREATED: Clock,
  NOTIFICATION: Info,
  CREATE: Clock,
  APPROVE: CheckCircle2,
  REJECT: XCircle,
  CANCEL: XCircle,
  BALANCE_CHANGED: Activity,
  BALANCE_ADDED: Activity,
  USER_UPDATED: Info,
  USER_DEACTIVATED: AlertTriangle,
  USER_DELETED: XCircle,
  OVERTIME_ADDED: Clock,
  OVERTIME_CANCELLED: XCircle,
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
            const sev = actionSeverity[item.type] ?? item.severity;
            const cfg = severityConfig[sev] ?? severityConfig.INFO;
            const Icon = actionIcons[item.type] ?? cfg.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5"
              >
                <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-lg', cfg.bg, cfg.color)}>
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
