import { ArrowRight, Bell, CheckCircle2, TrendingUp, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../../shared/types';

const feedIcons: Record<string, React.ElementType> = {
  REQUEST_APPROVED: CheckCircle2, REQUEST_REJECTED: XCircle, REQUEST_CREATED: Bell,
  BALANCE_UPDATED: TrendingUp, KPI_UPDATED: TrendingUp, SYSTEM: Bell,
};

const feedColors: Record<string, string> = {
  REQUEST_APPROVED: 'text-emerald-400 bg-emerald-500/10', REQUEST_REJECTED: 'text-rose-400 bg-rose-950/300/10',
  REQUEST_CREATED: 'text-blue-400 bg-blue-500/10', BALANCE_UPDATED: 'text-violet-400 bg-violet-500/10',
  KPI_UPDATED: 'text-amber-400 bg-amber-500/10', SYSTEM: 'text-white/40 bg-white/[0.04]',
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
    <div className="enterprise-card p-6 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-white/50">Активность</p>
        <button onClick={() => navigate('/notifications')} className="flex items-center gap-1 text-[13px] font-semibold text-[#4C7DFF] hover:text-[#6B96FF] transition-colors">
          Все <ArrowRight size={13} />
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.04]">
            <Bell size={18} className="text-white/25" />
          </div>
          <p className="text-[14px] font-medium text-white/35">Пока тихо</p>
          <p className="text-[13px] text-white/25">Уведомления появятся здесь</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {recent.map((n) => {
            const Icon = feedIcons[n.type] || Bell;
            const colorClass = feedColors[n.type] || 'text-white/40 bg-white/[0.04]';
            return (
              <button key={n.id} type="button" onClick={() => navigate('/notifications')}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 w-full text-left transition-colors hover:bg-white/[0.03]">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${colorClass.split(' ')[1]} ${colorClass.split(' ')[0]}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-white/85">{n.title}</p>
                  <p className="truncate text-[13px] text-white/50 mt-0.5">{n.message}</p>
                </div>
                <span className="shrink-0 text-[13px] text-white/30 mt-1">{timeAgo(n.createdAt)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
