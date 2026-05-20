import { useQuery } from '@tanstack/react-query';
import { CalendarEventList } from '../components/calendar/CalendarEventList';
import { api } from '../shared/api';

export function CalendarPage() {
  const calendarQuery = useQuery({
    queryKey: ['calendar'],
    queryFn: api.calendar,
  });
  const calendar = calendarQuery.data ?? { approved: [], pending: [] };

  return (
    <>
      <CalendarEventList title="Approved" events={calendar.approved ?? []} />
      <CalendarEventList title="Pending" events={calendar.pending ?? []} />
    </>
  );
}
