import type { AiForecast, AuditLogResponse, BalanceOperation, CalendarEvent, Dashboard, KpiRecalculationResult, KpiResponse, NotificationItem, Overtime, OvertimeCalendarEntry, OvertimeReport, PayrollReport, PositionHistory, RequestStatus, Role, Team, TimeOffRequest, User, VacationRequest, VacationType, WorkloadReport } from '../types';
import { ApiError, mapApiError, NetworkError, TimeoutError } from './errors';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

let accessToken: string | null = null;

export const setAccessToken = (token?: string) => {
  if (!token) {
    return;
  }

  accessToken = token;
  localStorage.setItem('qa-timeoff-token', token);
};

export const clearAccessToken = () => {
  accessToken = null;
  localStorage.removeItem('qa-timeoff-token');
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new NetworkError('No internet connection');
  }

  const timeoutMs = 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw mapApiError(response.status, text);
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
      throw new TimeoutError('Request timeout exceeded');
    }

    throw new NetworkError(error instanceof Error ? error.message : 'Unknown network error');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  auth: (initData: string) =>
    request<{ token?: string; accessToken?: string }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),
  dashboard: () => request<Dashboard>('/dashboard'),
  me: () => request<User>('/auth/me'),
  balanceMe: () => request<Dashboard['balance']>('/balance/me'),
  balanceOperations: () => request<BalanceOperation[]>('/balance/operations'),
  addBalance: (payload: { userId: string; hours: number; reason: string }) =>
    request('/balance/add', { method: 'POST', body: JSON.stringify(payload) }),
  writeOffBalance: (payload: { userId: string; hours: number; reason: string }) =>
    request('/balance/write-off', { method: 'POST', body: JSON.stringify(payload) }),
  users: () => request<User[]>('/users'),
  createUser: (payload: {
    telegramId: string;
    fullName: string;
    username?: string;
    email?: string;
    position?: string;
    role?: Role;
    teamId?: string;
    managerId?: string;
    isActive?: boolean;
  }) => request<User>('/users', { method: 'POST', body: JSON.stringify(payload) }),
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
    }>,
  ) => request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  userOperations: (userId: string) => request<BalanceOperation[]>(`/balance/operations/${userId}`),
  createTimeOff: (payload: { date: string; hours: number; reason: string; comment?: string }) =>
    request('/timeoff/request', { method: 'POST', body: JSON.stringify(payload) }),
  createVacation: (payload: { startDate: string; endDate: string; vacationType: VacationType; comment?: string }) =>
    request('/vacation/request', { method: 'POST', body: JSON.stringify(payload) }),
  myTimeOff: () => request<TimeOffRequest[]>('/timeoff/my'),
  myVacations: () => request<VacationRequest[]>('/vacation/my'),
  pendingTimeOff: () => request<TimeOffRequest[]>('/timeoff/pending'),
  pendingVacations: () => request<VacationRequest[]>('/vacation/pending'),
  approveTimeOff: (id: string) => request(`/timeoff/${id}/approve`, { method: 'PATCH' }),
  rejectTimeOff: (id: string, approverComment?: string) =>
    request(`/timeoff/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ approverComment }) }),
  cancelTimeOff: (id: string) => request(`/timeoff/${id}/cancel`, { method: 'PATCH' }),
  approveVacation: (id: string) => request(`/vacation/${id}/approve`, { method: 'PATCH' }),
  rejectVacation: (id: string, approverComment?: string) =>
    request(`/vacation/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ approverComment }) }),
  cancelVacation: (id: string) => request(`/vacation/${id}/cancel`, { method: 'PATCH' }),
  reviewRequest: (id: string, status: Extract<RequestStatus, 'APPROVED' | 'REJECTED'>) =>
    status === 'APPROVED' ? api.approveTimeOff(id) : api.rejectTimeOff(id),
  calendar: () => request<{ approved: CalendarEvent[]; pending: CalendarEvent[] }>('/calendar'),
  calendarTeam: (teamId: string) => request<{ approved: CalendarEvent[]; pending: CalendarEvent[] }>(`/calendar/team/${teamId}`),
  teams: () => request<Team[]>('/teams'),
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
  // ── Hourly Rate ──────────────────────────────────────────────────

  updateHourlyRate: (userId: string, hourlyRate: number, currency?: string) =>
    request<User>(`/admin/users/${userId}/hourly-rate`, {
      method: 'PATCH',
      body: JSON.stringify({ hourlyRate, currency }),
    }),

  // ── Overtime Cancel ──────────────────────────────────────────────

  cancelOvertime: (overtimeId: string) =>
    request<Overtime>(`/admin/overtime/${overtimeId}/cancel`, { method: 'PATCH' }),

  // ── KPI ──────────────────────────────────────────────────────────

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

  // ── Export ───────────────────────────────────────────────────────

  exportOvertimeCsv: (params?: { startDate?: string; endDate?: string; teamId?: string; userId?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.userId) search.set('userId', params.userId);
    return `${API_URL}/admin/export/overtime.csv${search.size > 0 ? `?${search.toString()}` : ''}`;
  },
  exportPayrollCsv: (params?: { startDate?: string; endDate?: string; teamId?: string; userId?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.userId) search.set('userId', params.userId);
    return `${API_URL}/admin/export/payroll.csv${search.size > 0 ? `?${search.toString()}` : ''}`;
  },
  exportKpiCsv: (params?: { month?: number; year?: number }) => {
    const search = new URLSearchParams();
    if (params?.month) search.set('month', String(params.month));
    if (params?.year) search.set('year', String(params.year));
    return `${API_URL}/admin/export/kpi.csv${search.size > 0 ? `?${search.toString()}` : ''}`;
  },
  export1cOvertimeCsv: (params?: { startDate?: string; endDate?: string; teamId?: string; userId?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.userId) search.set('userId', params.userId);
    return `${API_URL}/admin/export/1c/overtime.csv${search.size > 0 ? `?${search.toString()}` : ''}`;
  },
  export1cPayrollCsv: (params?: { startDate?: string; endDate?: string; teamId?: string; userId?: string }) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    if (params?.teamId) search.set('teamId', params.teamId);
    if (params?.userId) search.set('userId', params.userId);
    return `${API_URL}/admin/export/1c/payroll.csv${search.size > 0 ? `?${search.toString()}` : ''}`;
  },

  // ── Audit Log ────────────────────────────────────────────────────

  auditLog: (params?: { entityType?: string; entityId?: string }) => {
    const search = new URLSearchParams();
    if (params?.entityType) search.set('entityType', params.entityType);
    if (params?.entityId) search.set('entityId', params.entityId);
    const qs = search.toString();
    return request<AuditLogResponse>(`/admin/audit-log${qs ? `?${qs}` : ''}`);
  },
};
