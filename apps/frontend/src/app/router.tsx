import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { FallbackPage } from '../pages/FallbackPage';
import { PrivateRoute } from './PrivateRoute';

const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })));
const AdminPage = lazy(() => import('../pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const BalancePage = lazy(() => import('../pages/BalancePage').then((module) => ({ default: module.BalancePage })));
const CalendarPage = lazy(() => import('../pages/calendar-events/CalendarEventsPage').then((module) => ({ default: module.CalendarEventsPage })));
const CreateTimeOffPage = lazy(() => import('../pages/CreateTimeOffPage').then((module) => ({ default: module.CreateTimeOffPage })));
const CreateVacationPage = lazy(() => import('../pages/CreateVacationPage').then((module) => ({ default: module.CreateVacationPage })));
const ManagerRequestsPage = lazy(() => import('../pages/ManagerRequestsPage').then((module) => ({ default: module.ManagerRequestsPage })));
const MyRequestsPage = lazy(() => import('../pages/MyRequestsPage').then((module) => ({ default: module.MyRequestsPage })));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const RequestsPage = lazy(() => import('../pages/RequestsPage').then((module) => ({ default: module.RequestsPage })));
const TeamPage = lazy(() => import('../pages/TeamPage').then((module) => ({ default: module.TeamPage })));
const SettingsOrganizationPage = lazy(() => import('../pages/SettingsOrganizationPage').then((module) => ({ default: module.SettingsOrganizationPage })));
const SettingsRolesPage = lazy(() => import('../pages/SettingsRolesPage').then((module) => ({ default: module.SettingsRolesPage })));
const InvitesPage = lazy(() => import('../pages/InvitesPage').then((module) => ({ default: module.InvitesPage })));
const InviteAcceptPage = lazy(() => import('../pages/InviteAcceptPage').then((module) => ({ default: module.InviteAcceptPage })));
const EmployeesPage = lazy(() => import('../pages/EmployeesPage').then((module) => ({ default: module.EmployeesPage })));
const BalanceEmployeesPage = lazy(() => import('../pages/BalanceEmployeesPage').then((module) => ({ default: module.BalanceEmployeesPage })));

const withSuspense = (node: React.ReactNode) => <Suspense fallback={<FallbackPage />}>{node}</Suspense>;

const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ChangePasswordPage = lazy(() => import('../pages/ChangePasswordPage').then((module) => ({ default: module.ChangePasswordPage })));
const CreateUserPage = lazy(() => import('../pages/CreateUserPage').then((module) => ({ default: module.CreateUserPage })));
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(<LoginPage />),
  },
  {
    path: '/change-password',
    element: withSuspense(<ChangePasswordPage />),
  },
  {
    path: '/invite/accept',
    element: withSuspense(<InviteAcceptPage />),
  },
  {
    path: '/',
    element: <PrivateRoute />,
    errorElement: <FallbackPage />,
    children: [
      {
        element: <App />,
        children: [
          {
            index: true,
            element: withSuspense(<HomePage />),
          },
          { path: 'dashboard', element: <Navigate to="/" replace /> },
          { path: 'balance', element: withSuspense(<BalancePage />) },
          { path: 'balance/employees', element: withSuspense(<BalanceEmployeesPage />) },
          { path: 'timeoff/new', element: withSuspense(<CreateTimeOffPage />) },
          { path: 'vacation/new', element: withSuspense(<CreateVacationPage />) },
          { path: 'calendar', element: withSuspense(<CalendarPage />) },
          { path: 'leave-requests', element: <Navigate to="/requests/my" replace /> },
          { path: 'requests/manager', element: withSuspense(<ManagerRequestsPage />) },
          { path: 'requests/approvals', element: withSuspense(<ManagerRequestsPage />) },
          { path: 'requests/my', element: withSuspense(<MyRequestsPage />) },
          { path: 'requests', element: withSuspense(<RequestsPage />) },
          { path: 'requests/new', element: <Navigate to="/timeoff/new" replace /> },
          { path: 'notifications', element: withSuspense(<NotificationsPage />) },
          { path: 'profile', element: withSuspense(<ProfilePage />) },
          { path: 'team', element: withSuspense(<TeamPage />) },
          { path: 'employees', element: withSuspense(<EmployeesPage />) },
          { path: 'teams', element: withSuspense(<TeamPage />) },
          { path: 'analytics', element: withSuspense(<AnalyticsPage />) },
          { path: 'analytics/workload', element: withSuspense(<AnalyticsPage />) },
          { path: 'reports', element: withSuspense(<ReportsPage />) },
          { path: 'admin', element: withSuspense(<AdminPage />) },
          { path: 'admin/users', element: withSuspense(<AdminPage />) },
          { path: 'admin/users/new', element: withSuspense(<CreateUserPage />) },
          { path: 'settings/organization', element: withSuspense(<SettingsOrganizationPage />) },
          { path: 'settings/roles', element: withSuspense(<SettingsRolesPage />) },
          { path: 'settings', element: <Navigate to="/settings/organization" replace /> },
          { path: 'import', element: <Navigate to="/admin" replace /> },
          { path: 'invites', element: withSuspense(<InvitesPage />) },
          { path: 'audit-log', element: withSuspense(<AdminPage />) },
          { path: 'invites', element: withSuspense(<InvitesPage />) },
          { path: 'logs', element: withSuspense(<AdminPage />) },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
