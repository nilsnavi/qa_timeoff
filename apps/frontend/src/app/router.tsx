import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { AdminPage } from '../pages/AdminPage';
import { BalancePage } from '../pages/BalancePage';
import { CalendarPage } from '../pages/CalendarPage';
import { CreateTimeOffPage } from '../pages/CreateTimeOffPage';
import { CreateVacationPage } from '../pages/CreateVacationPage';
import { FallbackPage } from '../pages/FallbackPage';
import { HomePage } from '../pages/HomePage';
import { ManagerRequestsPage } from '../pages/ManagerRequestsPage';
import { MyRequestsPage } from '../pages/MyRequestsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { isOnboardingComplete, OnboardingPage } from '../pages/OnboardingPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RequestsPage } from '../pages/RequestsPage';

export const router = createBrowserRouter([
  { path: '/onboarding', element: <OnboardingPage />, errorElement: <FallbackPage /> },
  {
    path: '/',
    element: <App />,
    errorElement: <FallbackPage />,
    children: [
      { index: true, element: isOnboardingComplete() ? <HomePage /> : <Navigate to="/onboarding" replace /> },
      { path: 'balance', element: <BalancePage /> },
      { path: 'timeoff/new', element: <CreateTimeOffPage /> },
      { path: 'vacation/new', element: <CreateVacationPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'requests/manager', element: <ManagerRequestsPage /> },
      { path: 'requests/my', element: <MyRequestsPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
