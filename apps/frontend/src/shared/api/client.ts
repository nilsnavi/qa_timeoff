import type { CalendarEvent, Dashboard, RequestStatus, VacationType } from '../types';

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
  me: () => request('/auth/me'),
  balanceMe: () => request('/balance/me'),
  balanceOperations: () => request('/balance/operations'),
  addBalance: (payload: { userId: string; hours: number; reason: string }) =>
    request('/balance/add', { method: 'POST', body: JSON.stringify(payload) }),
  writeOffBalance: (payload: { userId: string; hours: number; reason: string }) =>
    request('/balance/write-off', { method: 'POST', body: JSON.stringify(payload) }),
  createTimeOff: (payload: { date: string; hours: number; reason: string; comment?: string }) =>
    request('/timeoff/request', { method: 'POST', body: JSON.stringify(payload) }),
  createVacation: (payload: { startDate: string; endDate: string; vacationType: VacationType; comment?: string }) =>
    request('/vacation/request', { method: 'POST', body: JSON.stringify(payload) }),
  pendingTimeOff: () => request('/timeoff/pending'),
  approveTimeOff: (id: string) => request(`/timeoff/${id}/approve`, { method: 'PATCH' }),
  rejectTimeOff: (id: string, approverComment?: string) =>
    request(`/timeoff/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ approverComment }) }),
  reviewRequest: (id: string, status: Extract<RequestStatus, 'APPROVED' | 'REJECTED'>) =>
    status === 'APPROVED' ? api.approveTimeOff(id) : api.rejectTimeOff(id),
  calendar: () => request<{ approved: CalendarEvent[]; pending: CalendarEvent[] }>('/calendar'),
  notifications: () => request('/notifications'),
};
