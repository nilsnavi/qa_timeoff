import { CalendarDays, AlertTriangle } from 'lucide-react';
import type { UpcomingEvent } from '../../shared/types';
import { clsx } from 'clsx';

const severityStyles = {
  INFO: { icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/15' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/15' },
};

export function UpcomingEventsWidget({ events }: { events: UpcomingEvent[] }) {
  return (
    <div className="enterprise-card p-4">
      <h3 className="text-[14px] font-bold text-white flex items-center gap-2 mb-3">
        <CalendarDays size={16} className="text-amber-400" />
        Ближайшие события
      </h3>

      {events.length === 0 ? (
        <div className="rounded-lg bg-white/[0.02] p-4 text-center">
          <p className="text-[13px] text-white/40">Нет событий на ближайшие 7 дней</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, i) => {
            const cfg = severityStyles[event.severity] ?? severityStyles.INFO;
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className={clsx('flex items-start gap-3 rounded-lg border p-2.5', cfg.bg, cfg.border)}
              >
                <span className={clsx('shrink-0 text-[11px] font-bold', cfg.color)}>
                  {event.dateLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white/70 truncate">{event.title}</p>
                  <p className="text-[12px] text-white/40 truncate">{event.description}</p>
                </div>
                <Icon size={14} className={clsx('shrink-0 mt-0.5', cfg.color)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
