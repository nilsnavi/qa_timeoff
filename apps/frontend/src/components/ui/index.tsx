import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getStatusLabel, hapticImpact } from '../../shared/utils';

type FieldBaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
};

// ── Button ────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-9 px-3 text-[13px]',
        size === 'md' && 'min-h-12 px-4 text-[14px]',
        size === 'lg' && 'min-h-14 px-5 text-[15px]',
        variant === 'primary' && 'bg-gradient-to-r from-[#4C7DFF] to-[#7C5CFF] text-white shadow-lg shadow-blue-500/20',
        variant === 'secondary' && 'bg-white/[0.06] text-[#B8C0D0] ring-1 ring-white/10 hover:bg-white/[0.10]',
        variant === 'ghost' && 'bg-transparent text-[#B8C0D0] hover:text-white',
        variant === 'danger' && 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/20 hover:bg-rose-500/30',
        className,
      )}
      onClick={(event) => {
        hapticImpact(variant === 'danger' ? 'medium' : 'light');
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('enterprise-card p-4', className)}>{children}</section>;
}

// ── Field Shell ───────────────────────────────────────────────────────────

const fieldInputClass =
  'field-input';

function FieldShell({ label, hint, error, children, className }: FieldBaseProps & { children: ReactNode }) {
  return (
    <div className={clsx('field-shell', className)}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {(hint || error) && (
        <span className={clsx('field-hint', error && 'error')}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────

export function Input({ label, hint, error, className, ...props }: FieldBaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <input
        className={clsx(fieldInputClass, error && 'error', className)}
        placeholder={props.placeholder ?? ' '}
        {...props}
      />
    </FieldShell>
  );
}

export const Field = Input;

export function DatePicker(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & FieldBaseProps) {
  return <Input type="date" {...props} />;
}

// ── Textarea ──────────────────────────────────────────────────────────────

export function Textarea({ label, hint, error, className, ...props }: FieldBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <textarea
        className={clsx(fieldInputClass, 'min-h-24 resize-none', error && 'error', className)}
        {...props}
      />
    </FieldShell>
  );
}

// ── Select (Portal Dropdown) ──────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  label,
  hint,
  error,
  children,
  className,
  value,
  onChange,
  disabled,
}: FieldBaseProps & { value?: string | number; onChange?: React.ChangeEventHandler<HTMLSelectElement>; children: ReactNode; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options: SelectOption[] = [];
  let selectedLabel = '';

  const childArray = Array.isArray(children) ? children : [children];
  for (const child of childArray) {
    if (child && typeof child === 'object' && 'type' in child && child.type === 'option') {
      const option = child as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>;
      const optionValue = String(option.props.value ?? '');
      const optionLabel = String(option.props.children ?? optionValue);
      options.push({ value: optionValue, label: optionLabel });
      if (optionValue === value) {
        selectedLabel = optionLabel;
      }
    }
  }

  const displayOptions = options.filter((o) => o.value !== '');

  const strValue = String(value ?? '');
  const selectedIndex = options.findIndex((o) => o.value === strValue);

  const handleTrigger = () => {
    setOpen((prev) => !prev);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (onChange) {
        const syntheticEvent = {
          target: { value: optionValue },
        } as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleSelect(options[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Position the dropdown below the trigger
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
      });
    }
  }, [open]);

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => dropdownRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <FieldShell label={label} hint={hint} error={error}>
      <div ref={triggerRef} className="relative">
        <button
          type="button"
          onClick={handleTrigger}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={clsx(
            fieldInputClass,
            'flex items-center justify-between gap-2 text-left w-full cursor-pointer',
            !value && 'text-[#7A8599]',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'error',
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={clsx('truncate', value !== undefined && value !== '' ? 'text-white' : 'text-[#7A8599]')}>
            {selectedLabel || 'Выберите...'}
          </span>
          <ChevronDown size={16} className={clsx('shrink-0 text-[#7A8599] transition-transform', open && 'rotate-180')} />
        </button>

        {open &&
          createPortal(
            <div className="portal-dropdown-backdrop" onClick={() => setOpen(false)}>
              <div
                ref={dropdownRef}
                className="portal-dropdown"
                style={dropdownStyle}
                role="listbox"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
              >
                {options.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === strValue}
                    className={clsx(
                      'portal-dropdown-option',
                      index === highlightedIndex && 'highlighted',
                      option.value === strValue && 'selected',
                    )}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.label}
                  </button>
                ))}
                {options.length === 0 && (
                  <div className="portal-dropdown-option text-[#7A8599]">Нет вариантов</div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </FieldShell>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'gradient';
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex min-h-6 items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase leading-normal',
        tone === 'neutral' && 'bg-white/[0.06] text-[#7A8599]',
        tone === 'info' && 'bg-blue-500/15 text-blue-400',
        tone === 'success' && 'bg-emerald-500/15 text-emerald-400',
        tone === 'warning' && 'bg-amber-500/15 text-amber-400',
        tone === 'danger' && 'bg-rose-500/15 text-rose-400',
        tone === 'gradient' && 'bg-gradient-to-r from-[#4C7DFF] to-[#7C5CFF] text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, Parameters<typeof Badge>[0]['tone']> = {
    DRAFT: 'neutral',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
  };

  return <Badge tone={tones[status] ?? 'neutral'}>{getStatusLabel(status)}</Badge>;
}

// ── Header ────────────────────────────────────────────────────────────────

export function Header({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#7A8599]">{eyebrow}</p>}
        <h1 className="text-[18px] font-bold tracking-tight text-white text-wrap">{title}</h1>
        {subtitle && <p className="text-[13px] font-medium text-[#B8C0D0]">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

// ── Bottom Navigation ──────────────────────────────────────────────────────

export function BottomNavigation({
  items,
}: {
  items: Array<{
    to: string;
    label: string;
    icon: ElementType<{ size?: string | number }>;
    active?: boolean;
    badge?: number;
    onClick?: () => void;
  }>;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] px-3 pb-[calc(0.5rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))]">
      <div className="rounded-2xl border border-white/[0.05] bg-[rgba(11,18,32,0.9)] px-1.5 py-1.5 shadow-[0_-2px_20px_rgba(0,0,0,0.4)] backdrop-blur-[16px]">
        <div className="grid grid-cols-5 gap-0">
          {items.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={item.onClick}
              className={clsx(
                'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition-all active:scale-95',
                item.active
                  ? 'text-white'
                  : 'text-[#7A8599] hover:text-[#B8C0D0]',
              )}
            >
              <span className="relative">
                <item.icon size={18} />
                {!!item.badge && (
                  <span className="absolute -right-2.5 -top-1.5 grid min-h-[14px] min-w-[14px] place-items-center rounded-full bg-rose-500 px-[3px] text-[9px] font-black leading-none text-white ring-2 ring-[#0B1220]">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="enterprise-card modal-content p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold text-white">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть окно">
            <X size={16} />
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5">{footer}</div>}
      </section>
    </div>,
    document.body,
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────

export function Toast({
  title,
  message,
  tone = 'success',
}: {
  title: string;
  message?: string;
  tone?: 'success' | 'error' | 'info';
}) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div className="enterprise-card fixed inset-x-4 top-4 z-[10001] mx-auto flex max-w-[400px] items-start gap-2.5 p-3">
      <Icon className={tone === 'error' ? 'text-rose-400' : 'text-emerald-400'} size={16} />
      <div>
        <p className="text-[14px] font-bold text-white">{title}</p>
        {message && <p className="text-[13px] font-medium text-[#B8C0D0]">{message}</p>}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grid place-items-center py-10 text-center">
      <div className="grid max-w-xs gap-3">
        <div className="mx-auto h-10 w-10 rounded-[10px] app-gradient opacity-80" />
        <h2 className="text-[16px] font-bold text-white">{title}</h2>
        {description && <p className="text-[14px] font-medium text-[#B8C0D0] text-wrap">{description}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </Card>
  );
}

// ── Error State ───────────────────────────────────────────────────────────

export function ErrorState({
  title = 'Что-то пошло не так',
  description = 'Не удалось загрузить данные. Попробуйте повторить запрос.',
  actionLabel = 'Повторить',
  onRetry,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="grid place-items-center py-10 text-center">
      <div className="grid max-w-xs gap-3">
        <AlertCircle className="mx-auto text-rose-400" size={28} />
        <h2 className="text-[16px] font-bold text-white">{title}</h2>
        {description && <p className="text-[14px] font-medium text-[#B8C0D0]">{description}</p>}
        {onRetry && (
          <div className="mt-1">
            <Button variant="secondary" onClick={onRetry}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-[10px] bg-white/[0.04]', className)} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-[10px]" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function Loader({ label = 'Загрузка' }: { label?: string }) {
  return (
    <div className="grid min-h-24 place-items-center">
      <div className="flex items-center gap-2 rounded-[10px] bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-[#B8C0D0]">
        <Loader2 className="animate-spin text-[#4C7DFF]" size={16} />
        {label}
      </div>
    </div>
  );
}
