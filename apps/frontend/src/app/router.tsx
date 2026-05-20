import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { AdminPage } from '../pages/AdminPage';
import { BalancePage } from '../pages/BalancePage';
import { CalendarPage } from '../pages/CalendarPage';
import { CreateTimeOffPage } from '../pages/CreateTimeOffPage';
import { CreateVacationPage } from '../pages/CreateVacationPage';
import { HomePage } from '../pages/HomePage';
import { ProfilePage } from '../pages/ProfilePage';
import { RequestsPage } from '../pages/RequestsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'balance', element: <BalancePage /> },
      { path: 'timeoff/new', element: <CreateTimeOffPage /> },
      { path: 'vacation/new', element: <CreateVacationPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
