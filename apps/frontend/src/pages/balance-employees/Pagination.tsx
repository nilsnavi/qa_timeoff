import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from '../../components/ui';
import type { ChangeEvent } from 'react';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  limitOptions: number[];
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function Pagination({
  page,
  limit,
  total,
  limitOptions,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-[#7A8599]">
          Показано {start}–{end} из {total}
        </span>
        <Select
          value={limit}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onLimitChange(Number(e.target.value))}
        >
          {limitOptions.map((n) => (
            <option key={n} value={n}>
              {n} строк
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-2 text-[#7A8599] hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Предыдущая страница"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers().map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-2 text-[#7A8599] text-[13px]">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={clsx(
                'min-w-[36px] h-9 rounded-lg text-[13px] font-semibold transition-colors',
                p === page
                  ? 'bg-gradient-to-r from-[#4C7DFF] to-[#7C5CFF] text-white'
                  : 'text-[#7A8599] hover:bg-white/[0.06] hover:text-white',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg p-2 text-[#7A8599] hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Следующая страница"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
