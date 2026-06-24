import { ArrowRight, Bell, CheckCircle2, TrendingUp, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../../shared/types';

const feedIcons: Record<string, React.ElementType> = {
  REQUEST_APPROVED: CheckCircle2,
  REQUEST_REJECTED: XCircle,
  REQUEST_CREATED: Bell,
  BALANCE_UPDATED: TrendingUp,
  KPI_UPDATED: TrendingUp,
  SYSTEM: Bell,
};

const feedColors: Record<string, string> = {
  REQUEST_APPROVED: 'text-emerald-400 bg-emerald-500/10',
  REQUEST_REJECTED: 'text-rose-400 bg-rose-950/300/10',
  REQUEST_CREATED: 'text-blue-400 bg-blue-500/10',
  BALANCE_UPDATED: 'text-violet-400 bg-violet-500/10',
  KPI_UPDATED: 'text-amber-400 bg-amber-500/10',
  SYSTEM: 'text-white/40 bg-white/[0.04]',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}мин`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч`;
  return `${Math.floor(hrs / 24)}дн`;
}

export function WorkFeed({ notifications }: { notifications: NotificationItem[] }) {
  const navigate = useNavigate();
  const recent = notifications.slice(0, 6);

  return (
    <div className="enterprise-card p-5 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/25">Активность</p>
        <button onClick={() => navigate('/notifications')} className="flex items-center gap-1 text-[11px] font-semibold text-[#4C7DFF] hover:text-[#6B96FF] transition-colors">
          Все <ArrowRight size={12} />
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="text-[13px] text-white/30 py-4 text-center">Нет активности</p>
      ) : (
        <div className="space-y-0.5">
          {recent.map((n) => {
            const Icon = feedIcons[n.type] || Bell;
            const colorClass = feedColors[n.type] || 'text-white/40 bg-white/[0.04]';
            return (
              <button key={n.id} type="button" onClick={() => navigate('/notifications')}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 w-full text-left transition-colors hover:bg-white/[0.03]">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${colorClass.split(' ')[1]} ${colorClass.split(' ')[0]}`}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white/80">{n.title}</p>
                  <p className="truncate text-[11px] text-white/30 mt-0.5">{n.message}</p>
                </div>
                <span className="shrink-0 text-[10px] text-white/20 mt-1">{timeAgo(n.createdAt)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
