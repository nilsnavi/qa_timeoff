import { Card, StatusBadge } from '../ui';
import type { CalendarEvent } from '../../shared/types';

const absenceTypeLabels: Record<CalendarEvent['absenceType'], string> = {
  TIME_OFF: 'Отгул',
  VACATION: 'Отпуск',
  HOLIDAY: 'Праздник',
};

export function CalendarEventList({ title, events }: { title: string; events: CalendarEvent[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-black text-white">{title}</h2>
      <div className="grid gap-2">
        {events.length === 0 && <p className="text-sm font-semibold text-[#7A8599]">Нет событий</p>}
        {events.map((event) => (
          <div key={`${event.absenceType}-${event.id}`} className="flex items-center justify-between rounded-2xl bg-[#111A2E]/65 p-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color }} />
              <div>
                <p className="font-bold text-[#B8C0D0]">{event.employee.fullName}</p>
                <p className="text-sm text-[#7A8599]">
                  {absenceTypeLabels[event.absenceType] ?? event.absenceType} · {event.startDate === event.endDate ? event.startDate : `${event.startDate} - ${event.endDate}`}
                </p>
              </div>
            </div>
            <StatusBadge status={event.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}
