import type { AiForecast, AuditLogEntry, AuditLogResponse, BalanceOperation, CalendarEvent, CalendarEventEntry, Dashboard, ImportUserResult, KpiPeriod, KpiRecalculationResult, KpiResponse, LeaveRequest, LeaveRequestSummary, NotificationItem, Overtime, OvertimeCalendarEntry, OvertimeReport, PaginatedCalendarEvents, PaginatedLeaveRequests, PayrollReport, PositionHistory, RequestStatus, Role, Team, TimeBalance, TimeOffRequest, User, VacationRequest, VacationType, WorkloadReport } from '../types';
import { ApiError, mapApiError, NetworkError, TimeoutError } from './errors';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAccessToken = (token?: string) => {
  if (!token) return;
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const getAccessToken = () => accessToken;

export const setOnUnauthorized = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new NetworkError('Нет подключения к интернету');
  }

  const timeoutMs = 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      const error = mapApiError(response.status, text);

      if (response.status === 401 && onUnauthorized) {
        onUnauthorized();
      }

      throw error;
    }

    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiError || error instanceof NetworkError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TimeoutError('Превышено время ожидания запроса');
    }

    throw new NetworkError(error instanceof Error ? error.message : 'Неизвестная ошибка сети');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: User; mustChangePassword?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  refreshToken: () =>
    request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
    }),
  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
    }),
  dashboard: () => request<Dashboard>('/dashboard'),
  me: () => request<User>('/auth/me'),
  balanceMe: () => request<Dashboard['balance']>('/balance/me'),
  getUserBalance: (userId: string) => request<TimeBalance>(`/balance/user/${userId}`),
  balanceHistory: (days?: number) => request(`/balance/history${days ? `?days=${days}` : ''}`),
  balanceSummary: () => request('/balance/summary'),
  balanceLedger: (page?: number, limit?: number) => {
    const search = new URLSearchParams();
    if (page) search.set('page', String(page));
    if (limit) search.set('limit', String(limit));
    const qs = search.toString();
    return request(`/balance/ledger${qs ? `?${qs}` : ''}`);
  },
  balanceOperations: () => request<BalanceOperation[]>('/balance/operations'),
  addBalance: (payload: { userId: string; hours: number; reason: string }) =>
    request('/balance/add', { method: 'POST', body: JSON.stringify(payload) }),
  writeOffBalance: (payload: { userId: string; hours: number; reason: string }) =>
    request('/balance/write-off', { method: 'POST', body: JSON.stringify(payload) }),
  users: () => request<User[]>('/users'),
  createUser: (payload: {
    telegramId?: string;
    fullName: string;
    username?: string;
    email?: string;
    position?: string;
    role?: Role;
    teamId?: string;
    managerId?: string;
    isActive?: boolean;
  }) => request<{ user: User; tempPassword: string }>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  importUsers: async (file: File): Promise<ImportUserResult[]> => {
    const token = localStorage.getItem('qa-timeoff-token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/users/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message ?? 'Ошибка импорта');
    }

    return response.json();
  },
  resetUserPassword: (userId: string) => request<{ tempPassword: string }>(`/users/${userId}/reset-password`, { method: 'POST' }),
  changePassword: (dto: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>('/users/me/password', { method: 'PATCH', body: JSON.stringify(dto) }),
  updateUser: (
    id: string,
    payload: Partial<{
      telegramId: string;
      fullName: string;
      username: string;
      email: string;
      position: string;
      role: Role;
      teamId: string;
      managerId: string;
      isActive: boolean;
      passwordHash: string;
    }>,
  ) => request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getUser: (id: string) => request<User>(`/users/${id}`),
  deleteUser: (id: string) => request<User>(`/users/${id}`, { method: 'DELETE' }),
  userOperations: (userId: string) => request<BalanceOperation[]>(`/balance/operations/${userId}`),
  createTimeOff: (payload: { date: string; hours: number; reason: string; comment?: string }) =>
    request('/timeoff/request', { method: 'POST', body: JSON.stringify(payload) }),
  createTimeOffBatch: (payload: { dates: string[]; hours: number; reason: string; comment?: string }) =>
    request('/timeoff/batch', { method: 'POST', body: JSON.stringify(payload) }),
  createVacation: (payload: { startDate: string; endDate: string; vacationType: VacationType; comment?: string }) =>
    request('/vacation/request', { method: 'POST', body: JSON.stringify(payload) }),
  myTimeOff: (params?: {
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status  && params.status  !== 'ALL') qs.set('status',  params.status);
    if (params?.from)   qs.set('from',   params.from);
    if (params?.to)     qs.set('to',     params.to);
    if (params?.limit)  qs.set('limit',  String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const q = qs.toString();
    return request<TimeOffRequest[]>(`/timeoff/my${q ? `?${q}` : ''}`);
  },

  myVacations: (params?: {
    status?: string;
    vacationType?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status       && params.status       !== 'ALL') qs.set('status',       params.status);
    if (params?.vacationType && params.vacationType !== 'ALL') qs.set('vacationType', params.vacationType);
    if (params?.from)   qs.set('from',   params.from);
    if (params?.to)     qs.set('to',     params.to);
    if (params?.limit)  qs.set('limit',  String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const q = qs.toString();
    return request<VacationRequest[]>(`/vacation/my${q ? `?${q}` : ''}`);
  },
  pendingTimeOff: () => request<TimeOffRequest[]>('/timeoff/pending'),
  pendingVacations: () => request<VacationRequest[]>('/vacation/pending'),
  approveTimeOff: (id: string) => request(`/timeoff/${id}/approve`, { method: 'PATCH' }),
  rejectTimeOff: (id: string, approverComment?: string) =>
    request(`/timeoff/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ approverComment }) }),
  cancelTimeOff: (id: string) => request(`/timeoff/${id}/cancel`, { method: 'PATCH' }),
  updateTimeOff: (id: string, payload: { date?: string; hours?: number; reason?: string }) =>
    request(`/timeoff/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  approveVacation: (id: string) => request(`/vacation/${id}/approve`, { method: 'PATCH' }),
  rejectVacation: (id: string, approverComment?: string) =>
    request(`/vacation/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ approverComment }) }),
  cancelVacation: (id: string) => request(`/vacation/${id}/cancel`, { method: 'PATCH' }),
  reviewRequest: (id: string, status: Extract<RequestStatus, 'APPROVED' | 'REJECTED'>) =>
    status === 'APPROVED' ? api.approveTimeOff(id) : api.rejectTimeOff(id),
  calendar: () => request<{ approved: CalendarEvent[]; pending: CalendarEvent[] }>('/calendar'),
  calendarTeam: (teamId: string) => request<{ approved: CalendarEvent[]; pending: CalendarEvent[] }>(`/calendar/team/${teamId}`),
  calendarUser: (userId: string) => request<{ approved: CalendarEvent[]; pending: CalendarEvent[] }>(`/calendar/user/${userId}`),
  holidays: (year?: number) => request<string[]>(`/calendar/holidays${year !== undefined ? `?year=${year}` : ''}`),

  // ── Calendar Events (dedicated enterprise calendar) ────────────────────

  calendarEvents: (params?: { month?: string; team_id?: string; user_id?: string; type?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.month) search.set('month', params.month);
    if (params?.team_id) search.set('team_id', params.team_id);
    if (params?.user_id) search.set('user_id', params.user_id);
    if (params?.type) search.set('type', params.type);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return request<PaginatedCalendarEvents>(`/calendar/events${qs ? `?${qs}` : ''}`);
  },
  createCalendarEvent: (payload: { type: CalendarEventEntry['type']; startDate: string; endDate: string; userId?: string; comment?: string }) =>
    request<CalendarEventEntry>('/calendar/events', { method: 'POST', body: JSON.stringify(payload) }),
  updateCalendarEvent: (id: string, payload: { type?: CalendarEventEntry['type']; startDate?: string; endDate?: string; comment?: string }) =>
    request<CalendarEventEntry>(`/calendar/events/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCalendarEvent: (id: string) => request<{ id: string }>(`/calendar/events/${id}`, { method: 'DELETE' }),
  approveCalendarEvent: (id: string) => request<CalendarEventEntry>(`/calendar/events/${id}/approve`, { method: 'POST' }),

  teams: () => request<Team[]>('/teams'),
  createTeam: (payload: { name: string; description?: string }) => request<Team>('/teams', { method: 'POST', body: JSON.stringify(payload) }),
  updateTeam: (id: string, payload: { name?: string; description?: string }) => request<Team>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTeam: (id: string) => request<void>(`/teams/${id}`, { method: 'DELETE' }),
  notifications: () => request<NotificationItem[]>('/notifications'),
  markNotificationRead: (id: string) => request<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<NotificationItem[]>('/notifications/read-all', { method: 'PATCH' }),

  // HR & Workforce Management
  updatePosition: (userId: string, position: string) =>
    request<User>(`/admin/users/${userId}/position`, { method: 'PATCH', body: JSON.stringify({ position }) }),
  positionHistory: (userId: string) => request<PositionHistory[]>(`/admin/users/${userId}/position-history`),
  addOvertime: (payload: { userId: string; hours: number; date: string; reason: string }) =>
    request<Overtime>('/admin/overtime', { method: 'POST', body: JSON.stringify(payload) }),
  userOvertime: (userId: string) => request<Overtime[]>(`/admin/overtime/user/${userId}`),
  overtimeCalendar: (params?: { userId?: string; teamId?: string; year?: number; month?: number }) => {
    const search = new URLSearchParams();
    if (params?.userId) search.set('userId', params.userId);
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.year) search.set('year', String(params.year));
    if (params?.month) search.set('month', String(params.month));
    const qs = search.toString();
    return request<OvertimeCalendarEntry[]>(`/admin/overtime/calendar${qs ? `?${qs}` : ''}`);
  },
  overtimeReport: (params?: { startDate?: string; endDate?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    const qs = search.toString();
    return request<OvertimeReport>(`/admin/reports/overtime${qs ? `?${qs}` : ''}`);
  },
  payrollReport: (params?: { startDate?: string; endDate?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    const qs = search.toString();
    return request<PayrollReport>(`/admin/reports/payroll${qs ? `?${qs}` : ''}`);
  },
  updateHourlyRate: (userId: string, hourlyRate: number, currency?: string) =>
    request<User>(`/admin/users/${userId}/hourly-rate`, {
      method: 'PATCH',
      body: JSON.stringify({ hourlyRate, currency }),
    }),
  cancelOvertime: (overtimeId: string) =>
    request<Overtime>(`/admin/overtime/${overtimeId}/cancel`, { method: 'PATCH' }),

  // ── KPI ──────────────────────────────────────────────────────────

  myKpi: () => request<KpiPeriod[]>('/kpi/me'),

  kpiList: (params?: { userId?: string; month?: number; year?: number }) => {
    const search = new URLSearchParams();
    if (params?.userId) search.set('userId', params.userId);
    if (params?.month) search.set('month', String(params.month));
    if (params?.year) search.set('year', String(params.year));
    const qs = search.toString();
    return request<KpiResponse>(`/admin/kpi${qs ? `?${qs}` : ''}`);
  },
  kpiByUser: (userId: string) => request(`/admin/kpi/user/${userId}`),
  recalculateKpi: () => request<KpiRecalculationResult>('/admin/kpi/recalculate', { method: 'POST' }),

  // ── Analytics ────────────────────────────────────────────────────

  workloadReport: (params?: { startDate?: string; endDate?: string; teamId?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    if (params?.teamId) search.set('teamId', params.teamId);
    const qs = search.toString();
    return request<WorkloadReport>(`/admin/analytics/workload${qs ? `?${qs}` : ''}`);
  },

  // ── AI Forecast ──────────────────────────────────────────────────

  aiForecast: (params?: { teamId?: string; monthsLookback?: number }) => {
    const search = new URLSearchParams();
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.monthsLookback) search.set('monthsLookback', String(params.monthsLookback));
    const qs = search.toString();
    return request<AiForecast>(`/admin/ai/overtime-forecast${qs ? `?${qs}` : ''}`);
  },

  // ── Leave Requests ────────────────────────────────────────────────────

  leaveRequests: (params?: { status?: string; team_id?: string; user_id?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.team_id) search.set('team_id', params.team_id);
    if (params?.user_id) search.set('user_id', params.user_id);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return request<PaginatedLeaveRequests>(`/leave-requests${qs ? `?${qs}` : ''}`);
  },
  leaveRequestsSummary: () => request<LeaveRequestSummary>('/leave-requests/summary'),
  createLeaveRequest: (payload: { type: 'TIME_OFF' | 'VACATION'; dateFrom: string; dateTo?: string; hours: number; reason: string; comment?: string }) =>
    request<LeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(payload) }),
  getLeaveRequest: (id: string) => request<LeaveRequest>(`/leave-requests/${id}`),
  approveLeaveRequest: (id: string) => request<LeaveRequest>(`/leave-requests/${id}/approve`, { method: 'POST' }),
  rejectLeaveRequest: (id: string, approverComment?: string) =>
    request<LeaveRequest>(`/leave-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ approverComment }) }),

  // ── Audit Log ────────────────────────────────────────────────────

  auditLog: (params?: { entityType?: string; entityId?: string }) => {
    const search = new URLSearchParams();
    if (params?.entityType) search.set('entityType', params.entityType);
    if (params?.entityId) search.set('entityId', params.entityId);
    const qs = search.toString();
    return request<AuditLogResponse>(`/admin/audit-log${qs ? `?${qs}` : ''}`);
  },
  updateNotifications: (dto: { notifyRequestUpdates?: boolean; notifyTeamRequests?: boolean; notifyEmailDigest?: boolean }) =>
    request<User>('/users/me/notifications', { method: 'PATCH', body: JSON.stringify(dto) }),

  getSseToken: () =>
    request<{ token: string }>('/auth/sse-token', { method: 'POST' }),

  auditLogs: (params?: { entityType?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request<{ items: AuditLogEntry[]; total: number }>(`/admin/audit${q ? `?${q}` : ''}`);
  },

  adminStats: () => request<{ totalUsers: number; activeUsers: number; blockedUsers: number; teamsCount: number; newUsersThisMonth: number; byRole: { role: string; count: number }[] }>('/admin/stats'),
  adminUsers: (params?: { search?: string; role?: string; teamId?: string }) => {
    const search = new URLSearchParams();
    if (params?.search) search.set('search', params.search);
    if (params?.role) search.set('role', params.role);
    if (params?.teamId) search.set('teamId', params.teamId);
    const qs = search.toString();
    return request<User[]>('/admin/users' + (qs ? `?${qs}` : ''));
  },
  disableUser: (id: string) => request<User>(`/admin/users/${id}/disable`, { method: 'PATCH' }),
};
