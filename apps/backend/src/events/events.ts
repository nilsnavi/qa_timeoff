export const LeaveRequestEvents = {
  CREATED: 'leave-request.created',
  APPROVED: 'leave-request.approved',
  REJECTED: 'leave-request.rejected',
} as const;

export interface LeaveRequestCreatedEvent {
  requestId: string;
  userId: string;
  teamId: string | null;
  type: string;
  hours: number;
  dateFrom: string;
  dateTo?: string;
}

export interface LeaveRequestApprovedEvent {
  requestId: string;
  userId: string;
  teamId: string | null;
  approvedById: string;
  hours: number;
}

export interface LeaveRequestRejectedEvent {
  requestId: string;
  userId: string;
  teamId: string | null;
  rejectedById: string;
  reason?: string;
}

export const CalendarEventEvents = {
  CREATED: 'calendar-event.created',
  UPDATED: 'calendar-event.updated',
  DELETED: 'calendar-event.deleted',
  APPROVED: 'calendar-event.approved',
} as const;

export interface CalendarEventCreatedEvent {
  eventId: string;
  userId: string;
  teamId: string | null;
  type: string;
  startDate: string;
  endDate: string;
}

export interface CalendarEventUpdatedEvent {
  eventId: string;
  userId: string;
  changes: Record<string, unknown>;
}

export interface CalendarEventDeletedEvent {
  eventId: string;
  userId: string;
}

export interface CalendarEventApprovedEvent {
  eventId: string;
  userId: string;
  teamId: string | null;
}

export type CalendarEventEventPayload = CalendarEventCreatedEvent | CalendarEventUpdatedEvent | CalendarEventDeletedEvent | CalendarEventApprovedEvent;

export type LeaveRequestEventPayload = LeaveRequestCreatedEvent | LeaveRequestApprovedEvent | LeaveRequestRejectedEvent;
