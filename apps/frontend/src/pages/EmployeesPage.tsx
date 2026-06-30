import { useAuth } from '../shared/auth/AuthContext';
import { TeamPage } from './TeamPage';

export function EmployeesPage() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return <div className="rounded-xl bg-white/[0.03] p-6 text-center text-white/40">Нет доступа</div>;
  }
  return <TeamPage />;
}
