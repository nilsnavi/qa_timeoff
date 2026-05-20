import type { Dashboard } from '../types';

export const mockDashboard: Dashboard = {
  user: {
    id: 'u-1',
    telegramId: '100000001',
    fullName: 'Admin User',
    username: 'qa_admin',
    email: 'admin@qa-timeoff.local',
    role: 'ADMIN',
    position: 'QA Admin',
    teamId: 'team-1',
    team: { id: 'team-1', name: 'QA Team', description: 'Core quality assurance team' },
    isActive: true,
  },
  balance: {
    id: 'balance-1',
    userId: 'u-1',
    balanceHours: 40,
    totalAddedHours: 64,
    totalUsedHours: 24,
    updatedAt: new Date().toISOString(),
  },
  requests: [
    {
      id: 'r-1',
      userId: 'u-2',
      date: '2026-05-22',
      hours: 8,
      reason: 'Personal time off',
      status: 'PENDING',
      user: {
        id: 'u-2',
        telegramId: '100000002',
        fullName: 'QA Lead',
        username: 'qa_lead',
        role: 'LEAD',
        position: 'QA Lead',
        teamId: 'team-1',
        isActive: true,
      },
    },
  ],
  vacations: [
    {
      id: 'v-1',
      userId: 'u-3',
      startDate: '2026-06-03',
      endDate: '2026-06-10',
      daysCount: 6,
      vacationType: 'ANNUAL',
      status: 'APPROVED',
      user: {
        id: 'u-3',
        telegramId: '100000003',
        fullName: 'Anna Tester',
        username: 'anna_tester',
        role: 'EMPLOYEE',
        position: 'QA Engineer',
        teamId: 'team-1',
        isActive: true,
      },
    },
  ],
  teamCalendar: [],
  operations: [
    { id: 'o-1', userId: 'u-1', operationType: 'ADD', hours: 16, reason: 'Release support', createdAt: '2026-05-18T10:00:00Z' },
    { id: 'o-2', userId: 'u-1', operationType: 'WRITE_OFF', hours: -8, reason: 'Time off', createdAt: '2026-05-16T10:00:00Z' },
  ],
  notifications: [
    {
      id: 'n-1',
      title: 'New request',
      message: 'QA Lead requested 8 hours off',
      type: 'REQUEST_CREATED',
      isRead: false,
      createdAt: '2026-05-20T09:00:00Z',
    },
  ],
};

mockDashboard.teamCalendar = mockDashboard.requests;
