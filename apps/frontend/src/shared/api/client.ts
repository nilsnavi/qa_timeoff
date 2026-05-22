import type { BalanceOperation, CalendarEvent, Dashboard, NotificationItem, RequestStatus, Role, Team, TimeOffRequest, User, VacationRequest, VacationType } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

let accessToken: string | null = localStorage.getItem('qa-timeoff-token');

export const setAccessToken = (token?: string) => {
  if (!token) {
    return;
  }

  accessToken = token;
  localStorage.setItem('qa-timeoff-token', token);
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
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
};
