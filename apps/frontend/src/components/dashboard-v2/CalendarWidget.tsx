import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Dashboard } from '../../shared/types';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const COLOR_MAP: Record<string, string> = { APPROVED: 'bg-emerald-500', PENDING: 'bg-amber-500', REJECTED: 'bg-rose-950/300' };

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOffset(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

export function CalendarWidget({ dashboard }: { dashboard: Dashboard }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOffset(year, month);

  const eventMap = useMemo(() => {
    const map = new Map<string, { type: string; status: string; title: string }[]>();
    for (const r of dashboard.requests) {
      const key = r.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ type: 'Отгул', status: r.status, title: r.reason });
    }
    for (const v of dashboard.vacations ?? []) {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ type: 'Отпуск', status: v.status, title: v.comment || 'Отпуск' });
      }
    }
    return map;
  }, [dashboard]);

  return (
    <div className="enterprise-card p-5 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-bold uppercase tracking-widest text-white/25">Календарь</p>
        <div className="flex items-center gap-1">
          <button onClick={() => { const m = month - 1; if (m < 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m); }} className="grid h-7 w-7 place-items-center rounded text-white/30 hover:text-white/70 hover:bg-white/[0.04]">
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[110px] text-center text-[14px] font-semibold text-white/70">{MONTHS[month]} {year}</span>
          <button onClick={() => { const m = month + 1; if (m > 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m); }} className="grid h-7 w-7 place-items-center rounded text-white/30 hover:text-white/70 hover:bg-white/[0.04]">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map(d => <span key={d} className="text-center text-[11px] font-bold text-white/20 py-1">{d}</span>)}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const events = eventMap.get(ds) || [];
          const dotColor = events.length > 0 ? COLOR_MAP[events[0].status] ?? 'bg-gray-500' : '';

          return (
            <div key={day} className="relative flex flex-col items-center py-1"
              onMouseEnter={() => setHoveredDay(events.length > 0 ? day : null)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span className={`text-[13px] font-semibold rounded-md w-7 h-7 flex items-center justify-center ${isToday ? 'bg-[#4C7DFF]/20 text-[#4C7DFF]' : 'text-white/50'}`}>{day}</span>
              {dotColor && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${dotColor}`} />}
              {hoveredDay === day && events.length > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 rounded-lg border border-white/[0.06] bg-[#1A2238] px-3 py-2 shadow-xl text-left min-w-[160px]">
                  {events.map((e, idx) => (
                    <div key={idx} className="text-[13px]">
                      <span className="font-semibold text-white">{e.type}</span>
                      <span className="text-white/40 ml-1">{e.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
