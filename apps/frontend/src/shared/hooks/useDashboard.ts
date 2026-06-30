import { useQuery } from '@tanstack/react-query';
import type { Dashboard, DashboardSummary } from '../types';
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

export function useDashboardSummary() {
  const { isAuthenticated } = useAuth();

  const query = useQuery<DashboardSummary | null>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboardSummary(),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  return {
    ...query,
    dashboard: query.data,
  };
}
