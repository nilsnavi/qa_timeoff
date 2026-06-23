import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, setAccessToken } from './client';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setAccessToken(undefined);
});

describe('api.auth', () => {
  it('отправляет POST /auth/telegram с initData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ token: 'test-token', user: { id: '1' } })),
    });

    const result = await api.auth('test-init-data');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/telegram',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ initData: 'test-init-data' }),
      }),
    );
    expect(result).toEqual({ token: 'test-token', user: { id: '1' } });
  });

  it('пробрасывает ApiError при 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    });

    await expect(api.auth('invalid-data')).rejects.toThrow('Unauthorized');
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
            user: { id: '1', fullName: 'Test' },
            balance: { balanceHours: 40 },
            requests: [],
            operations: [],
            notifications: [],
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
    expect(result.user.fullName).toBe('Test');
  });
});
