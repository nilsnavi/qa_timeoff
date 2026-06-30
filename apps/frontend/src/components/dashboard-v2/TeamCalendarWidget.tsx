import { useState } from 'react';
import { CalendarDays, User, Clock, Activity } from 'lucide-react';
import type { CalendarDay } from '../../shared/types';
import { clsx } from 'clsx';

const statusColors = {
  NORMAL: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/5' },
  WARNING: { dot: 'bg-amber-500', bg: 'bg-amber-500/5' },
  CRITICAL: { dot: 'bg-rose-500', bg: 'bg-rose-500/5' },
};

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function TeamCalendarWidget({ days }: { days: CalendarDay[] }) {
  const [tooltip, setTooltip] = useState<CalendarDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!days.length) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date(days[0].date).getMonth();

  const handleMouseEnter = (day: CalendarDay, e: React.MouseEvent) => {
    setTooltip(day);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="enterprise-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-400" />
          Календарь команды
        </h3>
        <span className="text-[13px] font-semibold text-white/50">{months[currentMonth]}</span>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-white/25 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const d = new Date(day.date);
          const dayNum = d.getDate();
          const isToday = day.date === todayStr;
          const cfg = statusColors[day.status];
          const hasEvents = day.events.length > 0;

          return (
            <div
              key={i}
              onMouseEnter={(e) => handleMouseEnter(day, e)}
              onMouseLeave={() => setTooltip(null)}
              className={clsx(
                'relative rounded-lg py-1.5 text-center cursor-default transition-colors min-h-[36px]',
                isToday ? 'bg-[#4C7DFF]/20 ring-1 ring-[#4C7DFF]/30' : cfg.bg,
                cfg.bg === 'bg-emerald-500/5' && !isToday ? 'hover:bg-white/[0.04]' : '',
              )}
            >
              <span className={clsx('text-[13px] font-semibold', isToday ? 'text-white' : 'text-white/50')}>
                {dayNum}
              </span>
              {hasEvents && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {day.events.filter(e => e.type === 'VACATION' && e.status === 'APPROVED').length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                  {day.events.filter(e => e.type === 'TIME_OFF' && e.status === 'APPROVED').length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  )}
                  {day.events.filter(e => e.status === 'PENDING').length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                  {day.status === 'CRITICAL' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.05]">
        <span className="flex items-center gap-1.5 text-[12px] text-white/40">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Отпуск
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-white/40">
          <span className="h-2 w-2 rounded-full bg-blue-400" /> Отгул
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-white/40">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Ожидает
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-white/40">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Конфликт
        </span>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 rounded-xl border border-white/[0.08] bg-[#111A2E] p-3 shadow-xl min-w-[200px]"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 80 }}
        >
          <p className="text-[13px] font-bold text-white mb-1">
            {new Date(tooltip.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </p>
          <div className="space-y-1 text-[12px]">
            <div className="flex items-center gap-1.5 text-white/60">
              <User size={12} /> Отсутствуют: {tooltip.approvedAbsences}
            </div>
            <div className="flex items-center gap-1.5 text-white/60">
              <Clock size={12} /> Ожидают: {tooltip.pendingAbsences}
            </div>
            <div className="flex items-center gap-1.5 text-white/60">
              <Activity size={12} /> Доступность: {tooltip.availabilityPercent}%
            </div>
            {tooltip.events.slice(0, 3).map((ev, j) => (
              <div key={j} className="text-white/40 truncate">• {ev.employeeName}</div>
            ))}
            {tooltip.events.length > 3 && (
              <div className="text-white/30">и ещё {tooltip.events.length - 3}...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
