import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Card, EmptyState, ErrorState, Button } from '../components/ui';
import { useAuth } from '../shared/auth/AuthContext';
import { showAppToast } from '../shared/utils';
import type { EmployeeBalance, EmployeeBalancesResponse } from '../shared/types';
import { BalanceSummaryCards, BalanceSummarySkeleton } from './balance-employees/BalanceSummaryCards';
import { EmployeeBalanceFilters, type BalancesFilters } from './balance-employees/EmployeeBalanceFilters';
import { EmployeeBalancesTable, EmployeeBalancesTableSkeleton } from './balance-employees/EmployeeBalancesTable';
import { Pagination } from './balance-employees/Pagination';
import { EMPLOYEE_BALANCES_MOCK, getMockBalancesResponse } from './balance-employees/employee-balances.mock';

const LIMIT_OPTIONS = [7, 10, 20, 50];
const DEFAULT_LIMIT = 7;

type SortField = 'employeeName' | 'department' | 'accruedHours' | 'usedHours' | 'plannedHours' | 'pendingHours' | 'availableHours' | 'updatedAt';

export function BalanceEmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EmployeeBalancesResponse | null>(null);

  const departments = useMemo(() => {
    const deps = new Set(EMPLOYEE_BALANCES_MOCK.map((e) => e.department));
    return Array.from(deps).sort();
  }, []);

  const applyFiltersAndSort = useCallback(
    (items: EmployeeBalance[]): EmployeeBalance[] => {
      let result = [...items];

      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (e) =>
            e.employeeName.toLowerCase().includes(q) ||
            (e.email && e.email.toLowerCase().includes(q)) ||
            (e.telegramUsername && e.telegramUsername.toLowerCase().includes(q)) ||
            e.department.toLowerCase().includes(q),
        );
      }

      if (filters.department) {
        result = result.filter((e) => e.department === filters.department);
      }

      if (filters.balanceType) {
        result = result.filter((e) => e.balanceType === filters.balanceType);
      }

      if (filters.status) {
        switch (filters.status) {
          case 'NORMAL':
            result = result.filter((e) => e.availableHours > 16);
            break;
          case 'LOW':
            result = result.filter((e) => e.availableHours >= 0 && e.availableHours <= 16);
            break;
          case 'NEGATIVE':
            result = result.filter((e) => e.availableHours < 0);
            break;
          case 'HAS_PENDING':
            result = result.filter((e) => e.pendingHours > 0);
            break;
        }
      }

      if (filters.problemOnly) {
        result = result.filter(
          (e) =>
            e.availableHours <= 16 ||
            e.availableHours < 0 ||
            e.pendingHours > 0,
        );
      }

      if (sort) {
        result.sort((a, b) => {
          const aVal = a[sort.field];
          const bVal = b[sort.field];
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sort.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sort.dir === 'asc' ? aVal - bVal : bVal - aVal;
          }
          return 0;
        });
      }

      return result;
    },
    [filters, sort],
  );

  const paginatedResult = useMemo(() => {
    if (!data) return null;
    const filtered = applyFiltersAndSort(data.items);
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);
    const uniqueEmployees = new Set(filtered.map((i) => i.employeeId)).size;
    return {
      items: paged,
      total: filtered.length,
      summary: {
        totalEmployees: uniqueEmployees,
        totalAvailableHours: filtered.reduce((s, i) => s + i.availableHours, 0),
        totalPlannedHours: filtered.reduce((s, i) => s + i.plannedHours, 0),
        totalPendingHours: filtered.reduce((s, i) => s + i.pendingHours, 0),
        negativeBalanceCount: filtered.filter((i) => i.availableHours < 0).length,
      },
    };
  }, [data, applyFiltersAndSort, page, limit]);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      const response = getMockBalancesResponse(EMPLOYEE_BALANCES_MOCK, 1, DEFAULT_LIMIT);
      setData(response);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'MANAGER')) {
      loadData();
    }
  }, [user, loadData]);

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

  if (error) {
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
          onRetry={loadData}
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

  if (!data && !isLoading) {
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
              <Button variant="primary" onClick={loadData}>
                Пересчитать балансы
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
    setPage(Math.max(1, Math.min(p, Math.ceil((paginatedResult?.total ?? 1) / limit))));
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      showAppToast('Балансы сотрудников пересчитаны');
      loadData();
    } catch {
      showAppToast('Не удалось пересчитать балансы', undefined, 'error');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExport = () => {
    if (!paginatedResult) return;
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

      {paginatedResult && <BalanceSummaryCards summary={paginatedResult.summary} />}

      <EmployeeBalanceFilters
        filters={filters}
        departments={departments}
        onChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
        onRecalculate={handleRecalculate}
        onExport={handleExport}
        isRecalculating={isRecalculating}
      />

      {paginatedResult && (
        <>
          <EmployeeBalancesTable
            items={paginatedResult.items}
            sort={sort}
            onSort={handleSort}
            onView={handleView}
            onHistory={handleHistory}
            onEdit={handleEdit}
          />
          <Pagination
            page={page}
            limit={limit}
            total={paginatedResult.total}
            limitOptions={LIMIT_OPTIONS}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </>
      )}

      {paginatedResult && paginatedResult.total === 0 && (
        <div className="enterprise-card grid place-items-center py-10 text-center">
          <div className="grid max-w-xs gap-3">
            <div className="mx-auto h-10 w-10 rounded-[10px] bg-white/[0.04]" />
            <h2 className="text-[16px] font-bold text-white">Нет данных по выбранным фильтрам</h2>
            <p className="text-[14px] font-medium text-[#B8C0D0]">
              Измените фильтры или выберите другой период.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
