export type Role = 'EMPLOYEE' | 'LEAD' | 'MANAGER' | 'ADMIN';
export type RequestType = 'TIME_OFF' | 'VACATION';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TelegramIdentity {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
}
