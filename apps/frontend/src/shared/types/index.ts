export type Role = 'EMPLOYEE' | 'LEAD' | 'MANAGER' | 'ADMIN';
export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type VacationType = 'ANNUAL' | 'UNPAID' | 'SICK_LEAVE' | 'OTHER';

export interface User {
  id: string;
  telegramId: string;
  fullName: string;
  username?: string;
  email?: string;
  position?: string;
  role: Role;
  teamId?: string;
  team?: Team;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
}

export interface TimeBalance {
  id: string;
  userId: string;
  balanceHours: number;
  totalAddedHours: number;
  totalUsedHours: number;
  updatedAt: string;
}

export interface BalanceOperation {
  id: string;
  userId: string;
  operationType: 'ADD' | 'WRITE_OFF' | 'MANUAL_CORRECTION' | 'EXPIRED';
  hours: number;
  reason: string;
  createdAt: string;
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  date: string;
  hours: number;
  reason: string;
  comment?: string;
  status: RequestStatus;
  user: User;
}

export interface VacationRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  vacationType: VacationType;
  status: RequestStatus;
  comment?: string;
  user: User;
}

export interface CalendarEvent {
  id: string;
  absenceType: 'TIME_OFF' | 'VACATION';
  startDate: string;
  endDate: string;
  employee: User;
  status: RequestStatus;
  color: string;
  hours?: number;
  daysCount?: number;
  vacationType?: VacationType;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface Dashboard {
  user: User;
  balance: TimeBalance;
  requests: TimeOffRequest[];
  vacations?: VacationRequest[];
  teamCalendar: TimeOffRequest[];
  operations: BalanceOperation[];
  notifications: NotificationItem[];
}
