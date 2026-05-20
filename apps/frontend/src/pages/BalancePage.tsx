import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Card, Select } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { BalanceOperation } from '../shared/types';

type OperationFilter = 'ALL' | BalanceOperation['operationType'];

export function BalancePage() {
  const { dashboard } = useDashboard();
  const { balance, operations } = dashboard;
  const [filter, setFilter] = useState<OperationFilter>('ALL');

  const filteredOperations = useMemo(
    () => operations.filter((operation) => filter === 'ALL' || operation.operationType === filter),
    [filter, operations],
  );
  const usedPercent = balance.totalAddedHours > 0 ? Math.min(100, Math.round((balance.totalUsedHours / balance.totalAddedHours) * 100)) : 0;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Current balance</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-5xl font-black leading-none text-slate-950 dark:text-white">{balance.balanceHours}</span>
              <span className="pb-1 text-base font-black text-slate-500 dark:text-slate-400">h</span>
            </div>
          </div>
          <BalanceDonut usedPercent={usedPercent} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Added"
          value={balance.totalAddedHours}
          icon={<ArrowUpCircle size={22} />}
          className="text-emerald-500"
        />
        <MetricCard
          label="Used"
          value={balance.totalUsedHours}
          icon={<ArrowDownCircle size={22} />}
          className="text-rose-500"
        />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Operations</h2>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{filteredOperations.length} shown</p>
          </div>
          <SlidersHorizontal className="text-blue-500" size={22} />
        </div>

        <Select label="Filter" value={filter} onChange={(event) => setFilter(event.target.value as OperationFilter)}>
          <option value="ALL">All operations</option>
          <option value="ADD">Added</option>
          <option value="WRITE_OFF">Written off</option>
          <option value="MANUAL_CORRECTION">Corrections</option>
          <option value="EXPIRED">Expired</option>
        </Select>

        <div className="mt-4 grid gap-2">
          {filteredOperations.length === 0 && <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No operations</p>}
          {filteredOperations.map((operation) => (
            <OperationRow key={operation.id} operation={operation} />
          ))}
        </div>
      </Card>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  className: string;
}) {
  return (
    <Card>
      <div className={`mb-3 ${className}`}>{icon}</div>
      <p className="text-3xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
    </Card>
  );
}

function BalanceDonut({ usedPercent }: { usedPercent: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (usedPercent / 100) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="14" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#balanceGradient)"
          strokeLinecap="round"
          strokeWidth="14"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
        <defs>
          <linearGradient id="balanceGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-black text-slate-950 dark:text-white">{usedPercent}%</p>
          <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">used</p>
        </div>
      </div>
    </div>
  );
}

function OperationRow({ operation }: { operation: BalanceOperation }) {
  const style = resolveOperationStyle(operation);

  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white/65 p-3 dark:bg-slate-900/60">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          <p className="truncate font-black text-slate-900 dark:text-white">{operation.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={style.tone}>{style.label}</Badge>
          <span className="text-xs font-bold text-slate-400">{new Date(operation.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <span className={`text-xl font-black ${style.text}`}>
        {operation.hours > 0 ? '+' : ''}
        {operation.hours}
      </span>
    </div>
  );
}

function resolveOperationStyle(operation: BalanceOperation) {
  if (operation.operationType === 'ADD') {
    return { label: 'Added', tone: 'success' as const, dot: 'bg-emerald-500', text: 'text-emerald-500' };
  }

  if (operation.operationType === 'WRITE_OFF' || operation.operationType === 'EXPIRED') {
    return { label: operation.operationType === 'EXPIRED' ? 'Expired' : 'Written off', tone: 'danger' as const, dot: 'bg-rose-500', text: 'text-rose-500' };
  }

  return { label: 'Correction', tone: 'info' as const, dot: 'bg-blue-500', text: 'text-blue-500' };
}
