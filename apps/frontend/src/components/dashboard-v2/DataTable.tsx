import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => ReactNode;
};

export type SortDirection = 'asc' | 'desc' | null;

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  sortKey?: string | null;
  sortDir?: SortDirection;
  onSort?: (key: string) => void;
  page?: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
  loading?: boolean;
  loadingRows?: number;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  sortKey,
  sortDir,
  onSort,
  page = 1,
  total = 0,
  pageSize = 20,
  onPageChange,
  emptyMessage = 'Нет данных',
  loading = false,
  loadingRows = 10,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#111A2E] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04] bg-[#0B1220]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'h-10 px-4 text-left text-[11px] font-bold uppercase tracking-widest text-white/30 select-none',
                    col.sortable && 'cursor-pointer hover:text-white/50 transition-colors',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} className="text-[#4C7DFF]" /> :
                      sortDir === 'desc' ? <ChevronDown size={12} className="text-[#4C7DFF]" /> :
                      <ChevronDown size={12} className="text-white/15" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-white/[0.02]">
                  {columns.map((col) => (
                    <td key={col.key} className="h-12 px-4">
                      <div className="h-3.5 rounded bg-white/[0.03] animate-pulse" style={{ width: col.key === columns[0].key ? `${40 + Math.random() * 40}%` : '60%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center text-[13px] text-white/20">{emptyMessage}</td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={String(row[keyField])}
                  className={clsx(
                    'border-b border-white/[0.02] transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-white/[0.02]',
                    rowClassName?.(row, idx),
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'h-12 px-4 text-[13px] text-white/80',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                      )}
                    >
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2.5">
          <span className="text-[11px] text-white/30">
            {total > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} из ${total}` : ''}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="grid h-7 w-7 place-items-center rounded text-white/30 hover:text-white/60 disabled:opacity-20"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className={clsx('grid h-7 min-w-[28px] place-items-center rounded text-[12px] font-semibold transition-colors',
                    p === page ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/60')}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="grid h-7 w-7 place-items-center rounded text-white/30 hover:text-white/60 disabled:opacity-20"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
