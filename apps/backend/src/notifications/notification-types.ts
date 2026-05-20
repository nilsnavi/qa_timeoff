export const NotificationType = {
  REQUEST_CREATED: 'REQUEST_CREATED',
  REQUEST_APPROVED: 'REQUEST_APPROVED',
  REQUEST_REJECTED: 'REQUEST_REJECTED',
  BALANCE_CHANGED: 'BALANCE_CHANGED',
  VACATION_REMINDER: 'VACATION_REMINDER',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
