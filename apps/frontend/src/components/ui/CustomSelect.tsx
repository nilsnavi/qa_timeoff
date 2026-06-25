import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  small?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '—',
  className,
  small = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-[10px]',
          'border border-white/10 bg-white/[0.04]',
          'font-medium text-white outline-none transition-colors',
          'hover:border-white/20 hover:bg-white/[0.06]',
          open && 'border-[#4C7DFF]/50 bg-white/[0.06]',
          small ? 'px-3 py-2 text-[13px]' : 'px-3 py-3.5 text-[15px]',
        )}
      >
        <span className={clsx(!selected && 'text-white/35')}>{displayLabel}</span>
        <ChevronDown
          size={small ? 14 : 16}
          className={clsx(
            'shrink-0 text-white/40 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute z-50 mt-1.5 min-w-full w-max max-w-[280px] overflow-hidden',
            'rounded-xl border border-white/[0.10]',
            'bg-[#0F1829]',
            'shadow-[0_8px_32px_rgba(0,0,0,0.6)]',
          )}
        >
          <div className="max-h-[280px] overflow-y-auto py-1 custom-scrollbar">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left whitespace-nowrap transition-colors',
                  small ? 'text-[13px]' : 'text-[14px]',
                  opt.value === value
                    ? 'bg-[#4C7DFF]/15 text-[#6B96FF] font-semibold'
                    : 'text-white/75 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <span className={clsx(
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  opt.value === value ? 'bg-[#4C7DFF]' : 'bg-transparent',
                )} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
