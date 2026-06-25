import { Calendar, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Dashboard } from '../../shared/types';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function NextEventsWidget({ dashboard }: { dashboard: Dashboard }) {
  const navigate = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = [
    ...dashboard.requests
      .filter(r => r.status === 'APPROVED' && new Date(r.date) >= today)
      .map(r => ({ id: r.id, label: r.reason ?? 'Отгул', date: r.date, type: 'timeoff' as const })),
    ...(dashboard.vacations ?? [])
      .filter(v => v.status === 'APPROVED' && new Date(v.startDate) >= today)
      .map(v => ({ id: v.id, label: 'Отпуск', date: v.startDate, type: 'vacation' as const })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 4);

  return (
    <div className="enterprise-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-white/40" />
          <p className="text-[13px] font-semibold text-white/50">Ближайшие события</p>
        </div>
        <button onClick={() => navigate('/calendar')} className="flex items-center gap-1 text-[13px] font-semibold text-[#4C7DFF] hover:text-[#6B96FF] transition-colors">
          Все <ChevronRight size={13} />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-[14px] text-white/35">Нет запланированных событий</p>
          <button onClick={() => navigate('/timeoff/new')} className="text-[13px] text-[#4C7DFF] hover:text-[#6B96FF]">Создать заявку →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map(ev => {
            const daysLeft = Math.ceil((new Date(ev.date).getTime() - today.getTime()) / 86400000);
            return (
              <div key={ev.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3">
                <div className={`h-2 w-2 rounded-full shrink-0 ${ev.type === 'vacation' ? 'bg-violet-400' : 'bg-[#4C7DFF]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white/80 truncate">{ev.label}</p>
                  <p className="text-[13px] text-white/40">{formatDate(ev.date)}</p>
                </div>
                <span className={`text-[13px] font-bold shrink-0 ${daysLeft === 0 ? 'text-emerald-400' : daysLeft <= 3 ? 'text-amber-400' : 'text-white/30'}`}>
                  {daysLeft === 0 ? 'Сегодня' : `${daysLeft}дн`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
