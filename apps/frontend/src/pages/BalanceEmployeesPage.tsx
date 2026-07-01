import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, Card, EmptyState, ErrorState, Button } from '../components/ui';
import { useAuth } from '../shared/auth/AuthContext';
import { api } from '../shared/api';
import { showAppToast } from '../shared/utils';
import type { EmployeeBalancesParams, EmployeeBalancesResponse } from '../shared/types';
import { BalanceSummaryCards, BalanceSummarySkeleton } from './balance-employees/BalanceSummaryCards';
import { EmployeeBalanceFilters, type BalancesFilters } from './balance-employees/EmployeeBalanceFilters';
import { EmployeeBalancesTable, EmployeeBalancesTableSkeleton } from './balance-employees/EmployeeBalancesTable';
import { Pagination } from './balance-employees/Pagination';
import { BALANCE_TYPE_LABELS } from './balance-employees/employee-balances.mock';

const LIMIT_OPTIONS = [7, 10, 20, 50];
const DEFAULT_LIMIT = 7;

type SortField = 'employeeName' | 'department' | 'accruedHours' | 'usedHours' | 'plannedHours' | 'pendingHours' | 'availableHours' | 'updatedAt';

export function BalanceEmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<BalancesFilters>({
    search: '',
    department: '',
    balanceType: '',
    period: new Date().getFullYear(),
    status: '',
    problemOnly: false,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' } | null>(null);

  const departments = useMemo(() => Object.keys(BALANCE_TYPE_LABELS).length > 0 ? [] : [], []);

  const queryParams: EmployeeBalancesParams = useMemo(() => ({
    search: filters.search || undefined,
    department: filters.department || undefined,
    balanceType: filters.balanceType || undefined,
    period: filters.period,
    status: filters.status || undefined,
    problemOnly: filters.problemOnly || undefined,
    page,
    limit,
    sortBy: sort?.field,
    sortDir: sort?.dir,
  }), [filters, page, limit, sort]);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<EmployeeBalancesResponse>({
    queryKey: ['employeeBalances', queryParams],
    queryFn: () => api.employeeBalances(queryParams),
    enabled: !!user && (user.role === 'ADMIN' || user.role === 'MANAGER'),
    staleTime: 30_000,
  });

  const recalculateMutation = useMutation({
    mutationFn: () => api.recalculateBalances({ period: filters.period }),
    onSuccess: () => {
      showAppToast('Балансы сотрудников пересчитаны');
      queryClient.invalidateQueries({ queryKey: ['employeeBalances'] });
    },
    onError: () => {
      showAppToast('Не удалось пересчитать балансы', undefined, 'error');
    },
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    return (
      <div className="space-y-6">
        <Header eyebrow="/ Балансы сотрудников" title="Балансы сотрудников" />
        <Card className="grid place-items-center py-10 text-center">
          <div className="grid max-w-xs gap-3">
            <h2 className="text-[16px] font-bold text-white">Нет доступа</h2>
            <p className="text-[14px] font-medium text-[#B8C0D0]">
              У вас недостаточно прав для просмотра балансов сотрудников.
            </p>
            <Button variant="secondary" onClick={() => navigate('/balance')}>
              Мой баланс
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Header
          eyebrow="/ Балансы сотрудников"
          title="Балансы сотрудников"
          subtitle="Просмотр и контроль остатков отпусков, отгулов и других типов отсутствий сотрудников"
        />
        <ErrorState
          title="Не удалось загрузить балансы сотрудников"
          description="Проверьте подключение или повторите попытку."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header
          eyebrow="/ Балансы сотрудников"
          title="Балансы сотрудников"
          subtitle="Просмотр и контроль остатков отпусков, отгулов и других типов отсутствий сотрудников"
        />
        <BalanceSummarySkeleton />
        <Card>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 w-[160px] animate-pulse rounded-[10px] bg-white/[0.04]" />
              ))}
            </div>
          </div>
        </Card>
        <EmployeeBalancesTableSkeleton rows={7} />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-6">
        <Header
          eyebrow="/ Балансы сотрудников"
          title="Балансы сотрудников"
          subtitle="Просмотр и контроль остатков отпусков, отгулов и других типов отсутствий сотрудников"
        />
        <EmptyState
          title="Балансы сотрудников пока не рассчитаны"
          description="Добавьте сотрудников, настройте правила начисления или выполните первичный расчет балансов."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => navigate('/settings/organization')}>
                Настроить правила начисления
              </Button>
              <Button
                variant="primary"
                onClick={() => recalculateMutation.mutate()}
                disabled={recalculateMutation.isPending}
              >
                {recalculateMutation.isPending ? 'Расчет...' : 'Пересчитать балансы'}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev?.field === field) {
        return prev.dir === 'asc' ? { field, dir: 'desc' } : null;
      }
      return { field, dir: 'asc' };
    });
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(Math.max(1, Math.min(p, Math.ceil((data?.total ?? 1) / limit))));
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleExport = () => {
    showAppToast('Экспорт подготовлен', 'Файл будет загружен в ближайшее время', 'info');
  };

  const handleView = (employeeId: string) => {
    navigate(`/balance?userId=${employeeId}`);
  };

  const handleHistory = (employeeId: string) => {
    navigate(`/balance?userId=${employeeId}&tab=history`);
  };

  const handleEdit = (_employeeId: string) => {
    showAppToast('Корректировка баланса', 'Функция будет доступна в ближайшем обновлении', 'info');
  };

  return (
    <div className="space-y-5">
      <Header
        eyebrow="/ Балансы сотрудников"
        title="Балансы сотрудников"
        subtitle="Просмотр и контроль остатков отпусков, отгулов и других типов отсутствий сотрудников"
      />

      <BalanceSummaryCards summary={data.summary} />

      <EmployeeBalanceFilters
        filters={filters}
        departments={departments}
        onChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        onRecalculate={() => recalculateMutation.mutate()}
        onExport={handleExport}
        isRecalculating={recalculateMutation.isPending}
      />

      <EmployeeBalancesTable
        items={data.items}
        sort={sort}
        onSort={handleSort}
        onView={handleView}
        onHistory={handleHistory}
        onEdit={handleEdit}
      />

      <Pagination
        page={page}
        limit={limit}
        total={data.total}
        limitOptions={LIMIT_OPTIONS}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    </div>
  );
}
