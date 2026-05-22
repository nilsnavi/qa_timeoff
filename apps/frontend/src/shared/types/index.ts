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
  managerId?: string;
  manager?: User;
  isActive: boolean;
  timeBalance?: TimeBalance;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  users?: User[];
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
  user?: User;
  operationType: 'ADD' | 'WRITE_OFF' | 'MANUAL_CORRECTION' | 'EXPIRED';
  hours: number;
  reason: string;
  createdBy?: User;
  createdAt: string;
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  date: string;
  hours: number;
  reason: string;
  comment?: string;
  approverComment?: string;
  status: RequestStatus;
  user: User;
  approver?: User;
  createdAt?: string;
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
  approverComment?: string;
  user: User;
  approver?: User;
  createdAt?: string;
}

export interface CalendarEvent {
  id: string;
  absenceType: 'TIME_OFF' | 'VACATION' | 'HOLIDAY';
  startDate: string;
  endDate: string;
  employee: User;
  status: RequestStatus;
  color: string;
  hours?: number;
  daysCount?: number;
  vacationType?: VacationType;
  reason?: string;
  comment?: string;
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
