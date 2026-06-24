import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { FallbackPage } from '../pages/FallbackPage';

const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })));
const AdminPage = lazy(() => import('../pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const BalancePage = lazy(() => import('../pages/BalancePage').then((module) => ({ default: module.BalancePage })));
const CalendarPage = lazy(() => import('../pages/calendar-events/CalendarEventsPage').then((module) => ({ default: module.CalendarEventsPage })));
const OriginalCalendarPage = lazy(() => import('../pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const LeaveRequestPage = lazy(() => import('../pages/leave-requests/LeaveRequestPage').then((module) => ({ default: module.LeaveRequestPage })));
const CreateTimeOffPage = lazy(() =>
  import('../pages/CreateTimeOffPage').then((module) => ({ default: module.CreateTimeOffPage })),
);
const CreateVacationPage = lazy(() =>
  import('../pages/CreateVacationPage').then((module) => ({ default: module.CreateVacationPage })),
);
const ManagerRequestsPage = lazy(() =>
  import('../pages/ManagerRequestsPage').then((module) => ({ default: module.ManagerRequestsPage })),
);
const MyRequestsPage = lazy(() => import('../pages/MyRequestsPage').then((module) => ({ default: module.MyRequestsPage })));
const NotificationsPage = lazy(() =>
  import('../pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const ProfilePage = lazy(() => import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const RequestsPage = lazy(() => import('../pages/RequestsPage').then((module) => ({ default: module.RequestsPage })));

const withSuspense = (node: React.ReactNode) => <Suspense fallback={<FallbackPage />}>{node}</Suspense>;

const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));

const CreateUserPage = lazy(() => import('../pages/CreateUserPage').then((module) => ({ default: module.CreateUserPage })));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(<LoginPage />),
  },
  {
    path: '/',
    element: <App />,
    errorElement: <FallbackPage />,
    children: [
      {
        index: true,
        element: withSuspense(<HomePage />),
      },
      { path: 'balance', element: withSuspense(<BalancePage />) },
      { path: 'timeoff/new', element: withSuspense(<CreateTimeOffPage />) },
      { path: 'vacation/new', element: withSuspense(<CreateVacationPage />) },
      { path: 'calendar', element: withSuspense(<CalendarPage />) },
      { path: 'calendar/old', element: withSuspense(<OriginalCalendarPage />) },
      { path: 'leave-requests', element: withSuspense(<LeaveRequestPage />) },
      { path: 'requests/manager', element: withSuspense(<ManagerRequestsPage />) },
      { path: 'requests/my', element: withSuspense(<MyRequestsPage />) },
      { path: 'requests', element: withSuspense(<RequestsPage />) },
      { path: 'notifications', element: withSuspense(<NotificationsPage />) },
      { path: 'profile', element: withSuspense(<ProfilePage />) },
      { path: 'admin', element: withSuspense(<AdminPage />) },
      { path: 'admin/users/new', element: withSuspense(<CreateUserPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
