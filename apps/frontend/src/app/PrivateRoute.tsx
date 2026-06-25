import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';

export function PrivateRoute() {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-[#4C7DFF]" />
      </main>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
