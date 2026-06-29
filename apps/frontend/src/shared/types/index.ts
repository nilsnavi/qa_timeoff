export type Role = 'EMPLOYEE' | 'LEAD' | 'MANAGER' | 'ADMIN';
export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type LeaveRequestType = 'TIME_OFF' | 'VACATION';
export type CalendarEventType = 'VACATION' | 'TIME_OFF' | 'SICK_LEAVE' | 'HOLIDAY';
export type CalendarEventStatus = 'CREATED' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type VacationType = 'ANNUAL' | 'UNPAID' | 'SICK_LEAVE' | 'OTHER';

export interface User {
  id: string;
  telegramId: string;
  fullName: string;
  username?: string;
  email?: string;
  position?: string;
  hourlyRate?: number;
  role: Role;
  teamId?: string;
  team?: Team;
  managerId?: string;
  manager?: User;
  isActive: boolean;
  notifyRequestUpdates?: boolean;
  notifyTeamRequests?: boolean;
  notifyEmailDigest?: boolean;
  timeBalance?: TimeBalance;
}

export interface PositionHistory {
  id: string;
  userId: string;
  position: string;
  changedBy: string;
  changer: { id: string; fullName: string };
  changedAt: string;
}

export interface Overtime {
  id: string;
  userId: string;
  user?: { id: string; fullName: string; telegramId: string; team?: Team };
  hours: number;
  date: string;
  reason: string;
  createdById: string;
  createdBy?: { id: string; fullName: string };
  createdAt: string;
}

export interface OvertimeCalendarEntry {
  date: string;
  userId: string;
  userName: string;
  team: Team | null;
  totalHours: number;
  color: string;
  records: Overtime[];
}

export interface OvertimeReport {
  departments: Array<{
    department: string;
    users: Array<{ userId: string; fullName: string; totalHours: number }>;
    departmentTotal: number;
  }>;
  topEmployees: Array<{ userId: string; fullName: string; teamName: string; totalHours: number }>;
  totalOvertimeHours: number;
  period: { start: string; end: string };
}

export interface PayrollReport {
  employees: Array<{
    userId: string;
    fullName: string;
    hourlyRate: number;
    teamName: string;
    totalHours: number;
    totalCost: number;
    details: Array<{ date: string; hours: number; dayType: string; multiplier: number; cost: number }>;
  }>;
  grandTotal: number;
  period: { start: string; end: string };
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

export interface LeaveRequest {
  id: string;
  userId: string;
  teamId?: string;
  type: LeaveRequestType;
  dateFrom: string;
  dateTo?: string;
  hours: number;
  reason: string;
  comment?: string;
  status: RequestStatus;
  approverId?: string;
  approver?: User;
  approverComment?: string;
  approvedAt?: string;
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestSummary {
  total: number;
  pendingCount: number;
}

export interface PaginatedLeaveRequests {
  items: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface CalendarEventEntry {
  id: string;
  userId: string;
  teamId?: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  status: CalendarEventStatus;
  comment?: string;
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCalendarEvents {
  items: CalendarEventEntry[];
  total: number;
  page: number;
  limit: number;
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

// ── KPI ─────────────────────────────────────────────────────────────

export interface KpiPeriod {
  id: string;
  userId: string;
  user?: {
    id: string;
    fullName: string;
    position?: string;
    team?: { id: string; name: string };
  };
  month: number;
  year: number;
  plannedHours: number;
  actualWorkedHours: number;
  overtimeHours: number;
  approvedRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  responseTimeAvgHours: number;
  workloadScore: number;
  reliabilityScore: number;
  kpiScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface KpiResponse {
  items: KpiPeriod[];
  total: number;
}

export interface KpiRecalculationResult {
  results: Array<{ userId: string; fullName: string; kpiScore: number }>;
  period: { month: number; year: number };
}

// ── Analytics / Workload ────────────────────────────────────────────

export interface WorkloadDay {
  date: string;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  cancelledHours: number;
  totalHours: number;
  users: string[];
  topUsers: Array<{ name: string; hours: number }>;
  pendingRequests: number;
}

export interface WorkloadUser {
  userId: string;
  fullName: string;
  teamName: string;
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  cancelledHours: number;
  requestCount: number;
  peakDay: string;
  riskLevel: 'normal' | 'increased' | 'overload' | 'critical';
  balanceHours: number;
}

export interface WorkloadReport {
  kpi: {
    totalOvertime: number;
    overloadedCount: number;
    avgLoad: number;
    topUser: { fullName: string; hours: number } | null;
    peakDay: { date: string; hours: number } | null;
    pendingRequests: number;
  };
  workloadByDay: WorkloadDay[];
  workloadByUser: WorkloadUser[];
  anomalyWarning: string | null;
  recommendations: string[];
}

// ── AI Forecast ─────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiForecast {
  generatedAt: string;
  riskLevel: RiskLevel;
  predictedOvertimeHours: number;
  overloadedUsers: Array<{
    userId: string;
    fullName: string;
    teamName: string;
    currentOvertime: number;
    predictedOvertime: number;
    riskLevel: RiskLevel;
  }>;
  recommendations: string[];
  period: { start: string; end: string };
}

// ── Audit Log ───────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actor: { id: string; fullName: string };
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
}

export interface ImportUserResult {
  fullName: string;
  email: string;
  tempPassword: string | null;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}
