import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

type FieldBaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
};

const fieldClass =
  'min-h-12 w-full rounded-[20px] border border-white/70 bg-white/75 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-violet-400/25 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[22px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-10 px-3 text-xs',
        size === 'md' && 'min-h-12 px-5 text-sm',
        size === 'lg' && 'min-h-14 px-6 text-base',
        variant === 'primary' && 'app-gradient text-white shadow-lg shadow-blue-500/25',
        variant === 'secondary' && 'bg-white/80 text-slate-800 ring-1 ring-white/70 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-slate-700',
        variant === 'ghost' && 'bg-transparent text-slate-600 dark:text-slate-300',
        variant === 'danger' && 'bg-rose-500 text-white shadow-lg shadow-rose-300/30',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('glass rounded-[24px] p-5 md:p-6', className)}>{children}</section>;
}

export function Input({ label, hint, error, className, ...props }: FieldBaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <input className={clsx(fieldClass, error && 'border-rose-300 focus:ring-rose-300/30', className)} {...props} />
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
        className={clsx(fieldClass, 'min-h-28 resize-none py-3', error && 'border-rose-300 focus:ring-rose-300/30', className)}
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
      <select className={clsx(fieldClass, error && 'border-rose-300 focus:ring-rose-300/30', className)} {...props}>
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
        'inline-flex min-h-7 items-center rounded-full px-3 text-xs font-black',
        tone === 'neutral' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        tone === 'info' && 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
        tone === 'success' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
        tone === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
        tone === 'danger' && 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
        tone === 'gradient' && 'app-gradient text-white',
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

  return <Badge tone={tones[status] ?? 'neutral'}>{status}</Badge>;
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
    <header className="mb-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{eyebrow}</p>}
        <h1 className="truncate text-2xl font-black tracking-normal text-slate-950 dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs font-bold text-blue-600 dark:text-blue-300">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function BottomNavigation({
  items,
}: {
  items: Array<{ to: string; label: string; icon: ElementType<{ size?: string | number }>; active?: boolean; onClick?: () => void }>;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl px-4 pb-4">
      <div className="glass grid grid-cols-5 gap-1 rounded-[28px] p-2">
        {items.map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={item.onClick}
            className={clsx(
              'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[20px] text-[11px] font-bold transition',
              item.active ? 'app-gradient text-white shadow-lg shadow-blue-500/25' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
          </button>
        ))}
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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-4 backdrop-blur-sm sm:place-items-center">
      <section className="glass w-full max-w-md rounded-[28px] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5">{footer}</div>}
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
    <div className="glass fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-[24px] p-4">
      <Icon className={tone === 'error' ? 'text-rose-500' : 'text-emerald-500'} size={22} />
      <div>
        <p className="font-black text-slate-950 dark:text-white">{title}</p>
        {message && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{message}</p>}
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
    <Card className="grid place-items-center py-10 text-center">
      <div className="grid max-w-xs gap-3">
        <div className="mx-auto h-14 w-14 rounded-[24px] app-gradient opacity-90" />
        <h2 className="text-lg font-black text-slate-950 dark:text-white">{title}</h2>
        {description && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{description}</p>}
        {action}
      </div>
    </Card>
  );
}

export function Loader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-32 place-items-center">
      <div className="flex items-center gap-3 rounded-[24px] bg-white/70 px-5 py-4 text-sm font-black text-slate-600 shadow-soft dark:bg-slate-900/70 dark:text-slate-300">
        <Loader2 className="animate-spin text-blue-500" size={20} />
        {label}
      </div>
    </div>
  );
}

function FieldShell({ label, hint, error, children }: FieldBaseProps & { children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
      {label && <span>{label}</span>}
      {children}
      {(hint || error) && <span className={clsx('text-xs font-bold', error ? 'text-rose-500' : 'text-slate-400')}>{error ?? hint}</span>}
    </label>
  );
}
