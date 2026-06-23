import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { getStatusLabel, hapticImpact } from '../../shared/utils';

type FieldBaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
};

const fieldClass =
  'min-h-10 w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white outline-none transition placeholder:text-white/30 focus:border-[#4C7DFF]/50 focus:ring-2 focus:ring-[#4C7DFF]/20';

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
        size === 'sm' && 'min-h-8 px-2.5 text-[11px]',
        size === 'md' && 'min-h-10 px-4 text-xs',
        size === 'lg' && 'min-h-12 px-5 text-sm',
        variant === 'primary' && 'bg-gradient-to-r from-[#4C7DFF] to-[#7C5CFF] text-white shadow-lg shadow-blue-500/20',
        variant === 'secondary' && 'bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.10]',
        variant === 'ghost' && 'bg-transparent text-white/50 hover:text-white/80',
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

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('enterprise-card p-3.5', className)}>{children}</section>;
}

export function Input({ label, hint, error, className, ...props }: FieldBaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <input className={clsx(fieldClass, error && 'border-rose-500/50 focus:ring-rose-500/20', className)} {...props} />
    </FieldShell>
  );
}

export const Field = Input;

export function DatePicker(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & FieldBaseProps) {
  return <Input type="date" {...props} />;
}

export function Textarea({ label, hint, error, className, ...props }: FieldBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <textarea
        className={clsx(fieldClass, 'min-h-24 resize-none py-2.5', error && 'border-rose-500/50 focus:ring-rose-500/20', className)}
        {...props}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  children,
  className,
  ...props
}: FieldBaseProps & React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <select className={clsx(fieldClass, error && 'border-rose-500/50 focus:ring-rose-500/20', className)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

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
        'inline-flex min-h-6 items-center rounded-full px-2.5 text-[10px] font-bold tracking-wide uppercase',
        tone === 'neutral' && 'bg-white/[0.06] text-white/50',
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
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/30">{eyebrow}</p>}
        <h1 className="truncate text-[18px] font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-[11px] font-medium text-blue-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl px-4 pb-[calc(0.5rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] lg:hidden">
      <div className="rounded-2xl border border-white/[0.05] bg-[rgba(11,18,32,0.9)] px-1.5 py-1 shadow-[0_-2px_20px_rgba(0,0,0,0.4)] backdrop-blur-[16px]">
        <div className="grid grid-cols-5 gap-0">
          {items.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={item.onClick}
              className={clsx(
                'relative flex min-h-[44px] flex-col items-center justify-center gap-0 rounded-xl text-[9px] font-bold transition-all active:scale-95',
                item.active
                  ? 'text-white'
                  : 'text-white/25 hover:text-white/50',
              )}
            >
              <span className="relative">
                <item.icon size={16} />
                {!!item.badge && (
                  <span className="absolute -right-2 -top-1.5 grid min-h-[12px] min-w-[12px] place-items-center rounded-full bg-rose-500 px-[2px] text-[8px] font-black leading-none text-white ring-2 ring-[#0B1220]">
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-4 backdrop-blur-sm sm:place-items-center">
      <section className="enterprise-card w-full max-w-md p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть окно">
            <X size={14} />
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4">{footer}</div>}
      </section>
    </div>
  );
}

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
    <div className="enterprise-card fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-start gap-2.5 p-3">
      <Icon className={tone === 'error' ? 'text-rose-400' : 'text-emerald-400'} size={16} />
      <div>
        <p className="text-xs font-bold text-white">{title}</p>
        {message && <p className="text-[11px] font-medium text-white/50">{message}</p>}
      </div>
    </div>
  );
}

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
    <Card className="grid place-items-center py-8 text-center">
      <div className="grid max-w-xs gap-2.5">
        <div className="mx-auto h-10 w-10 rounded-[10px] app-gradient opacity-80" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {description && <p className="text-xs font-medium text-white/50">{description}</p>}
        {action}
      </div>
    </Card>
  );
}

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
    <Card className="grid place-items-center py-8 text-center">
      <div className="grid max-w-xs gap-2.5">
        <AlertCircle className="mx-auto text-rose-400" size={24} />
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {description && <p className="text-xs font-medium text-white/50">{description}</p>}
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-[10px] bg-white/[0.04]', className)} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <div className="flex items-start gap-2.5">
        <Skeleton className="h-10 w-10 shrink-0 rounded-[10px]" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function Loader({ label = 'Загрузка' }: { label?: string }) {
  return (
    <div className="grid min-h-24 place-items-center">
      <div className="flex items-center gap-2 rounded-[10px] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/60">
        <Loader2 className="animate-spin text-[#4C7DFF]" size={16} />
        {label}
      </div>
    </div>
  );
}

function FieldShell({ label, hint, error, children }: FieldBaseProps & { children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-white/60">
      {label && <span>{label}</span>}
      {children}
      {(hint || error) && <span className={clsx('text-[10px] font-medium', error ? 'text-rose-400' : 'text-white/30')}>{error ?? hint}</span>}
    </label>
  );
}
