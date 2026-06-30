import { useQuery } from '@tanstack/react-query';
import type { Dashboard, DashboardSummary, User, TimeBalance, TimeOffRequest, VacationRequest, BalanceOperation, NotificationItem } from '../types';
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

function mapSummaryToDashboard(summary: DashboardSummary): Dashboard {
  const user: User = {
    id: summary.profile.id,
    telegramId: '',
    fullName: summary.profile.fullName,
    role: summary.profile.role,
    teamId: summary.profile.teamId ?? undefined,
    position: summary.profile.position,
    isActive: true,
    timeBalance: {
      id: summary.profile.id,
      userId: summary.profile.id,
      balanceHours: summary.balance.availableHours,
      totalAddedHours: summary.balance.totalHours,
      totalUsedHours: summary.balance.usedHours,
      updatedAt: new Date().toISOString(),
    },
  };

  const balance: TimeBalance = {
    id: summary.profile.id,
    userId: summary.profile.id,
    balanceHours: summary.balance.availableHours,
    totalAddedHours: summary.balance.totalHours,
    totalUsedHours: summary.balance.usedHours,
    updatedAt: new Date().toISOString(),
  };

  const pendReqCount = summary.requests.pendingApprovalCount + summary.requests.myPending;

  const pendingTimeOffs: TimeOffRequest[] = Array.from({ length: pendReqCount }, (_, i) => ({
    id: `pending-to-${i}`,
    userId: summary.profile.id,
    date: new Date().toISOString(),
    hours: 8,
    reason: '',
    status: 'PENDING' as const,
    user,
  }));

  const notifications: NotificationItem[] = (summary.notifications ?? []).map((n, i) => ({
    id: `n-${i}`,
    title: n.title,
    message: n.message ?? '',
    type: n.type,
    isRead: n.isRead ?? false,
    createdAt: n.createdAt ?? new Date().toISOString(),
  }));

  return {
    user,
    balance,
    requests: pendingTimeOffs,
    vacations: [] as VacationRequest[],
    teamCalendar: [] as TimeOffRequest[],
    operations: [] as BalanceOperation[],
    notifications,
  };
}

export function useDashboard() {
  const { isAuthenticated } = useAuth();

  const query = useQuery<DashboardSummary | null>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboardSummary(),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const dashboard = query.data ? mapSummaryToDashboard(query.data) : EMPTY_DASHBOARD;

  return {
    data: dashboard,
    dashboard,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: query.refetch,
  };
}

export function useDashboardSummary() {
  const { isAuthenticated } = useAuth();

  const query = useQuery<DashboardSummary | null>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboardSummary(),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return {
    ...query,
    dashboard: query.data,
  };
}
