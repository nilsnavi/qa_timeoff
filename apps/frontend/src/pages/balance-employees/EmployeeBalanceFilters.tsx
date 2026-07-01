import { Filter, RotateCcw, Search, X } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { Button, Select } from '../../components/ui';
import { BALANCE_TYPE_LABELS, EMPLOYEE_BALANCE_STATUS_LABELS } from './employee-balances.mock';

export interface BalancesFilters {
  search: string;
  department: string;
  balanceType: string;
  period: number;
  status: string;
  problemOnly: boolean;
}

interface EmployeeBalanceFiltersProps {
  filters: BalancesFilters;
  departments: string[];
  onChange: (filters: BalancesFilters) => void;
  onRecalculate: () => void;
  onExport: () => void;
  isRecalculating: boolean;
}

export function EmployeeBalanceFilters({
  filters,
  departments,
  onChange,
  onRecalculate,
  onExport,
  isRecalculating,
}: EmployeeBalanceFiltersProps) {
  const update = (patch: Partial<BalancesFilters>) => onChange({ ...filters, ...patch });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.department !== '' ||
    filters.balanceType !== '' ||
    filters.status !== '' ||
    filters.problemOnly;

  const handleReset = () => {
    onChange({
      search: '',
      department: '',
      balanceType: '',
      period: new Date().getFullYear(),
      status: '',
      problemOnly: false,
    });
  };

  const searchId = 'bal-search';

  return (
    <div className="enterprise-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <label htmlFor={searchId} className="field-label">
            Поиск
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8599]" />
            <input
              id={searchId}
              type="text"
              placeholder="Поиск по сотруднику"
              value={filters.search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => update({ search: e.target.value })}
              className="field-input pl-9"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => update({ search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7A8599] hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="w-[160px]">
          <Select
            label="Отдел"
            value={filters.department}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ department: e.target.value })}
          >
            <option value="">Отдел: Все</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[180px]">
          <Select
            label="Тип баланса"
            value={filters.balanceType}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ balanceType: e.target.value })}
          >
            <option value="">Тип баланса: Все</option>
            {Object.entries(BALANCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[140px]">
          <Select
            label="Период"
            value={filters.period}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ period: Number(e.target.value) })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Период: {y}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[200px]">
          <Select
            label="Статус"
            value={filters.status}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => update({ status: e.target.value })}
          >
            <option value="">Статус: Все</option>
            {Object.entries(EMPLOYEE_BALANCE_STATUS_LABELS)
              .filter(([k]) => k !== 'ALL')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </Select>
        </div>

        <div className="flex items-center gap-2 min-h-12">
          <label className="relative inline-flex cursor-pointer items-center gap-2.5">
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={filters.problemOnly}
                onChange={(e: ChangeEvent<HTMLInputElement>) => update({ problemOnly: e.target.checked })}
              />
              <div className="h-5 w-9 rounded-full bg-white/[0.08] ring-1 ring-white/10 transition-colors peer-checked:bg-amber-500/30 peer-checked:ring-amber-500/40" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[#7A8599] transition-transform peer-checked:translate-x-[18px] peer-checked:bg-amber-400" />
            </div>
            <span className="text-[13px] font-medium text-[#B8C0D0] select-none">Только проблемные</span>
          </label>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw size={14} />
              Сбросить
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={onExport}>
            <Filter size={14} />
            Экспорт Excel
          </Button>
          <Button variant="primary" size="md" onClick={onRecalculate} disabled={isRecalculating}>
            {isRecalculating ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Расчет...
              </>
            ) : (
              'Пересчитать'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
