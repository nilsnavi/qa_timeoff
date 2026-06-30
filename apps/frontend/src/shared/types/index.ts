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

export interface WorkloadAnalyticsFilters {
  dateFrom: string;
  dateTo: string;
  teamId: string | null;
  employeeId: string | null;
  status: string;
  loadType: string;
  unit: string;
}

export interface WorkloadAnalyticsSummary {
  totalOvertimeHours: number;
  overloadedEmployeesCount: number;
  activeEmployeesCount: number;
  averageOvertimePerEmployee: number;
  topEmployee: { id: string; fullName: string; hours: number; riskLevel: string } | null;
  peakDay: { date: string; hours: number; percentOfTotal: number } | null;
  pendingRequests: { count: number; hours: number };
}

export interface WorkloadRiskLevel {
  code: string;
  label: string;
  from: number;
  to: number | null;
}

export interface WorkloadRisk {
  levels: WorkloadRiskLevel[];
  criticalEmployees: Array<{ employeeId: string; fullName: string; hours: number }>;
}

export interface WorkloadDailyLoad {
  date: string;
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
  employeesCount: number;
  pendingRequestsCount: number;
  isAnomaly: boolean;
  topEmployees: Array<{ employeeId: string; fullName: string; hours: number }>;
}

export interface WorkloadEmployeeDetail {
  employeeId: string;
  fullName: string;
  shortName: string;
  teamId: string | null;
  teamName: string | null;
  position: string | null;
  role: string;
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  cancelledHours: number;
  requestsCount: number;
  peakDay: { date: string; hours: number } | null;
  lastTimeOffDate: string | null;
  timeOffBalanceHours: number;
  riskLevel: 'NORMAL' | 'WARNING' | 'HIGH' | 'CRITICAL';
  weeklyTrend: Array<{ date: string; hours: number }>;
}

export interface WorkloadRecommendation {
  type: string;
  severity: string;
  title: string;
  description: string;
}

export interface WorkloadAnalyticsResponse {
  filters: WorkloadAnalyticsFilters;
  summary: WorkloadAnalyticsSummary;
  risk: WorkloadRisk;
  dailyLoad: WorkloadDailyLoad[];
  employeeLoad: WorkloadEmployeeDetail[];
  recommendations: WorkloadRecommendation[];
}

export interface WorkloadReport {
  summary: WorkloadAnalyticsSummary;
  employeeLoad: WorkloadEmployeeDetail[];
  dailyLoad: WorkloadDailyLoad[];
  risk: WorkloadRisk;
  recommendations: WorkloadRecommendation[];
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

export interface DashboardProfile {
  id: string;
  fullName: string;
  shortName: string;
  role: Role;
  teamId: string | null;
  position: string;
  status: string;
  avatarUrl: string | null;
}

export interface DashboardBalance {
  availableHours: number;
  usedHours: number;
  totalHours: number;
  usedPercent: number;
}

export interface DashboardRequests {
  myPending: number;
  myApprovedThisMonth: number;
  pendingApprovalCount: number;
  pendingApprovalHours: number;
  approvalRate: number;
  averageApprovalTimeHours: number;
}

export interface DashboardTeam {
  employeesCount: number;
  absentToday: number;
  absenceByType: Record<string, number>;
  availableToday: number;
  availabilityPercent: number;
  overloadedEmployees: number;
  riskLevel: string;
}

export interface AttentionItem {
  type: string;
  severity: 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface QuickAction {
  label: string;
  icon: string;
  url: string;
}

export interface CalendarDay {
  date: string;
  approvedAbsences: number;
  pendingAbsences: number;
  availabilityPercent: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  events: Array<{
    employeeName: string;
    type: string;
    status: string;
    hours: number;
  }>;
}

export interface PendingApprovalItem {
  id: string;
  employeeName: string;
  employeeInitials: string;
  type: string;
  typeLabel: string;
  hours: number;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
}

export interface TeamAvailabilityDay {
  date: string;
  label: string;
  availabilityPercent: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface UpcomingEvent {
  date: string;
  dateLabel: string;
  title: string;
  description: string;
  type: string;
  severity: 'INFO' | 'WARNING';
}

export interface RequestFunnel {
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

export interface InsightItem {
  type: string;
  severity: 'INFO' | 'WARNING' | 'SUCCESS';
  title: string;
  description: string;
}

export interface ActivityItem {
  type: string;
  severity: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  title: string;
  description: string;
  createdAt: string;
  timeAgo: string;
}

export interface OnboardingStep {
  title: string;
  action: string;
}

export interface DashboardOnboarding {
  show: boolean;
  steps: OnboardingStep[];
}

export interface DashboardSummary {
  profile: DashboardProfile;
  greeting: string;
  balance: DashboardBalance;
  requests: DashboardRequests;
  team: DashboardTeam;
  attention: AttentionItem[];
  quickActions: QuickAction[];
  calendar: CalendarDay[];
  pendingApprovals: PendingApprovalItem[];
  teamAvailability: TeamAvailabilityDay[];
  upcomingEvents: UpcomingEvent[];
  funnel: RequestFunnel;
  insights: InsightItem[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  onboarding: DashboardOnboarding;
}
