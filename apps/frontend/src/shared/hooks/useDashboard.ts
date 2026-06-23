import { useQuery } from '@tanstack/react-query';
import type { Dashboard } from '../types';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

const EMPTY_DASHBOARD: Dashboard = {
  user: { id: '', telegramId: '', fullName: '', role: 'EMPLOYEE', isActive: true },
  balance: { id: '', userId: '', balanceHours: 0, totalAddedHours: 0, totalUsedHours: 0, updatedAt: '' },
  requests: [],
  vacations: [],
  teamCalendar: [],
  operations: [],
  notifications: [],
};

/**
 * Returns the shared dashboard query.
 * The query is enabled only when isAuthenticated is true,
 * ensuring no stale-token requests are made.
 */
export function useDashboard() {
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: isAuthenticated,
  });

  return {
    ...query,
    dashboard: query.data ?? EMPTY_DASHBOARD,
  };
}
