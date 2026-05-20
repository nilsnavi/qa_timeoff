import { Card, StatusBadge } from '../ui';
import type { CalendarEvent } from '../../shared/types';

export function CalendarEventList({ title, events }: { title: string; events: CalendarEvent[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-black text-slate-950">{title}</h2>
      <div className="grid gap-2">
        {events.length === 0 && <p className="text-sm font-semibold text-slate-500">No events</p>}
        {events.map((event) => (
          <div key={`${event.absenceType}-${event.id}`} className="flex items-center justify-between rounded-2xl bg-white/65 p-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color }} />
              <div>
                <p className="font-bold text-slate-800">{event.employee.fullName}</p>
                <p className="text-sm text-slate-500">
                  {event.absenceType} · {event.startDate === event.endDate ? event.startDate : `${event.startDate} - ${event.endDate}`}
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
