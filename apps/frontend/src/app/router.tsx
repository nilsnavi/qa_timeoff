import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { FallbackPage } from '../pages/FallbackPage';
import { isOnboardingComplete, OnboardingPage } from '../pages/OnboardingPage';

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

export const router = createBrowserRouter([
  { path: '/onboarding', element: <OnboardingPage />, errorElement: <FallbackPage /> },
  {
    path: '/',
    element: <App />,
    errorElement: <FallbackPage />,
    children: [
      {
        index: true,
        element: isOnboardingComplete() ? withSuspense(<HomePage />) : <Navigate to="/onboarding" replace />,
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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
