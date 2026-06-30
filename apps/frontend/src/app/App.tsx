import { Outlet } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ErrorBoundary } from './ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ErrorBoundary>
  );
}
