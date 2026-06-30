import { WalletCards } from 'lucide-react';
import { useAuth } from '../shared/auth/AuthContext';
import { Card } from '../components/ui';

export function BalanceEmployeesPage() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return <div className="rounded-xl bg-white/[0.03] p-6 text-center text-white/40">Нет доступа</div>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Балансы сотрудников</h1>
        <p className="text-[15px] text-white/40 mt-1">Просмотр баланса часов всех сотрудников</p>
      </div>
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-white/40">
          <WalletCards size={32} />
          <p className="text-[14px]">Здесь будет таблица балансов всех сотрудников</p>
        </div>
      </Card>
    </div>
  );
}
