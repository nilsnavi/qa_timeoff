import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, setAccessToken } from './client';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken(undefined);
});

describe('api.login', () => {
  it('отправляет POST /auth/login с email и password', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ accessToken: 'jwt-token', refreshToken: 'rt', user: { id: '1' } })),
    });

    const result = await api.login('test@test.com', 'pass123');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'pass123' }),
      }),
    );
    expect(result).toEqual({ accessToken: 'jwt-token', refreshToken: 'rt', user: { id: '1' } });
  });

  it('пробрасывает ApiError при 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    });

    await expect(api.login('bad@test.com', 'wrong')).rejects.toThrow('Unauthorized');
  });
});

describe('api.dashboard', () => {
  it('отправляет GET /dashboard с токеном', async () => {
    setAccessToken('my-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            profile: { id: '1', fullName: 'Test', shortName: 'Test', role: 'EMPLOYEE', teamId: null, position: '', status: 'ACTIVE', avatarUrl: null },
            greeting: '',
            balance: { availableHours: 40, usedHours: 0, totalHours: 40, usedPercent: 0 },
            requests: { myPending: 0, myApprovedThisMonth: 0, pendingApprovalCount: 0, pendingApprovalHours: 0, approvalRate: 100, averageApprovalTimeHours: 0 },
            team: { employeesCount: 1, absentToday: 0, absenceByType: {}, availableToday: 1, availabilityPercent: 100, overloadedEmployees: 0, riskLevel: 'LOW' },
            attention: [],
            quickActions: [],
            calendar: [],
            pendingApprovals: [],
            teamAvailability: [],
            upcomingEvents: [],
            funnel: { draft: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 },
            insights: [],
            activity: [],
            notifications: [],
            onboarding: { show: false, steps: [] },
          }),
        ),
    });

    const result = await api.dashboard();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/dashboard',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
    expect(result.profile.fullName).toBe('Test');
  });
});
