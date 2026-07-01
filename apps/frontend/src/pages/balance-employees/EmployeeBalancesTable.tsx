import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, History, Pencil } from 'lucide-react';
import type { EmployeeBalance } from '../../shared/types';
import { Badge, Skeleton } from '../../components/ui';
import { BALANCE_TYPE_LABELS } from './employee-balances.mock';

type SortField = 'employeeName' | 'department' | 'accruedHours' | 'usedHours' | 'plannedHours' | 'pendingHours' | 'availableHours' | 'updatedAt';

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  align?: 'left' | 'right' | 'center';
  minWidth?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'employee', label: 'Сотрудник', sortable: true, sortField: 'employeeName', minWidth: '200px' },
  { key: 'department', label: 'Отдел', sortable: true, sortField: 'department', minWidth: '100px' },
  { key: 'type', label: 'Тип', sortable: false, minWidth: '120px' },
  { key: 'accrued', label: 'Начислено', sortable: true, sortField: 'accruedHours', align: 'right', minWidth: '100px' },
  { key: 'used', label: 'Использовано', sortable: true, sortField: 'usedHours', align: 'right', minWidth: '110px' },
  { key: 'planned', label: 'Запланировано', sortable: true, sortField: 'plannedHours', align: 'right', minWidth: '120px' },
  { key: 'pending', label: 'На согласовании', sortable: true, sortField: 'pendingHours', align: 'center', minWidth: '130px' },
  { key: 'available', label: 'Доступно', sortable: true, sortField: 'availableHours', align: 'right', minWidth: '100px' },
  { key: 'updated', label: 'Обновлено', sortable: true, sortField: 'updatedAt', minWidth: '140px' },
  { key: 'actions', label: 'Действия', sortable: false, align: 'center', minWidth: '100px' },
];

function EmployeeAvatar({ name, initials }: { name: string; initials: string }) {
  const colors = [
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-violet-500/20 text-violet-400',
    'bg-amber-500/20 text-amber-400',
    'bg-rose-500/20 text-rose-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-pink-500/20 text-pink-400',
  ];
  const idx = name.length % colors.length;
  return (
    <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', colors[idx])}>
      {initials}
    </div>
  );
}

function AvailableBadge({ hours }: { hours: number }) {
  if (hours > 16) {
    return <Badge tone="success">{hours} ч</Badge>;
  }
  if (hours >= 0) {
    return <Badge tone="warning">{hours} ч</Badge>;
  }
  return <Badge tone="danger">{hours} ч</Badge>;
}

interface SortState {
  field: SortField;
  dir: 'asc' | 'desc';
}

interface EmployeeBalancesTableProps {
  items: EmployeeBalance[];
  sort: SortState | null;
  onSort: (field: SortField) => void;
  onView: (employeeId: string) => void;
  onHistory: (employeeId: string) => void;
  onEdit: (employeeId: string) => void;
}

function renderSortIcon(column: ColumnDef, sort: SortState | null) {
  if (!column.sortable || !column.sortField) return null;

  const isActive = sort?.field === column.sortField;
  const iconCls = 'ml-1 inline-block shrink-0';

  if (isActive) {
    return sort.dir === 'asc'
      ? <ArrowUp size={12} className={clsx(iconCls, 'text-[#4C7DFF]')} />
      : <ArrowDown size={12} className={clsx(iconCls, 'text-[#4C7DFF]')} />;
  }
  return <ArrowUpDown size={12} className={clsx(iconCls, 'text-[#7A8599] opacity-0 group-hover:opacity-100 transition-opacity')} />;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hour}:${min}`;
  } catch {
    return iso;
  }
}

export function EmployeeBalancesTable({
  items,
  sort,
  onSort,
  onView,
  onHistory,
  onEdit,
}: EmployeeBalancesTableProps) {
  return (
    <div className="enterprise-card overflow-hidden p-0">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'group px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-[#7A8599] select-none',
                    col.sortable && 'cursor-pointer hover:text-[#B8C0D0] transition-colors',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  style={{ minWidth: col.minWidth }}
                  onClick={() => {
                    if (col.sortable && col.sortField) onSort(col.sortField);
                  }}
                >
                  {col.label}
                  {col.sortable && renderSortIcon(col, sort)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {items.map((item) => (
              <tr
                key={item.id}
                className="transition-colors duration-150 hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar name={item.employeeName} initials={item.employeeInitials} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{item.employeeName}</p>
                      <p className="text-[12px] text-[#7A8599] truncate">
                        {item.email || item.telegramUsername || ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ minWidth: '100px' }}>
                  <Badge tone="neutral">{item.department}</Badge>
                </td>
                <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                  <span className="text-[13px] font-medium text-[#B8C0D0]">
                    {BALANCE_TYPE_LABELS[item.balanceType] || item.balanceType}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ minWidth: '100px' }}>
                  <span className="text-[14px] font-semibold text-white">{item.accruedHours} ч</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ minWidth: '110px' }}>
                  <span className="text-[14px] font-semibold text-[#B8C0D0]">{item.usedHours} ч</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ minWidth: '120px' }}>
                  <span className="text-[14px] font-semibold text-[#B8C0D0]">{item.plannedHours} ч</span>
                </td>
                <td className="px-4 py-3 text-center" style={{ minWidth: '130px' }}>
                  {item.pendingHours > 0 ? (
                    <Badge tone="info">{item.pendingHours} ч</Badge>
                  ) : (
                    <Badge tone="neutral">{item.pendingHours} ч</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right" style={{ minWidth: '100px' }}>
                  <AvailableBadge hours={item.availableHours} />
                </td>
                <td className="px-4 py-3" style={{ minWidth: '140px' }}>
                  <span className="text-[12px] text-[#7A8599]">{formatDate(item.updatedAt)}</span>
                </td>
                <td className="px-4 py-3" style={{ minWidth: '100px' }}>
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onView(item.employeeId)}
                      className="rounded-lg p-2 text-[#7A8599] hover:bg-white/[0.06] hover:text-[#4C7DFF] transition-colors"
                      title="Просмотр"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onHistory(item.employeeId)}
                      className="rounded-lg p-2 text-[#7A8599] hover:bg-white/[0.06] hover:text-[#B8C0D0] transition-colors"
                      title="История"
                    >
                      <History size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(item.employeeId)}
                      className="rounded-lg p-2 text-[#7A8599] hover:bg-white/[0.06] hover:text-amber-400 transition-colors"
                      title="Корректировка"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <div className="grid place-items-center py-12 text-center">
          <div className="grid max-w-xs gap-2">
            <p className="text-[14px] font-semibold text-[#B8C0D0]">Нет данных по выбранным фильтрам</p>
            <p className="text-[13px] text-[#7A8599]">Измените фильтры или выберите другой период.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmployeeBalancesTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="enterprise-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-[#7A8599]"
                  style={{ minWidth: col.minWidth }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </td>
                {COLUMNS.slice(1, -1).map((col) => (
                  <td key={col.key} className="px-4 py-3" style={{ minWidth: col.minWidth }}>
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </td>
                ))}
                <td className="px-4 py-3" style={{ minWidth: '100px' }}>
                  <div className="flex justify-center gap-0.5">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
