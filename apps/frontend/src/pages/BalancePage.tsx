import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, CircleSlash, RotateCw, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, Select, Skeleton, SkeletonCard } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { BalanceOperation } from '../shared/types';
import { getOperationTypeLabel } from '../shared/utils';

type OperationFilter = 'ALL' | BalanceOperation['operationType'];

export function BalancePage() {
  const { dashboard } = useDashboard();
  const [filter, setFilter] = useState<OperationFilter>('ALL');
  const balanceQuery = useQuery({
    queryKey: ['balance', 'me'],
    queryFn: api.balanceMe,
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });
  const operationsQuery = useQuery({
    queryKey: ['balance', 'operations'],
    queryFn: api.balanceOperations,
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  const balance = balanceQuery.data ?? dashboard.balance;
  const operations = operationsQuery.data ?? dashboard.operations;
  const filteredOperations = useMemo(
    () => operations.filter((operation) => filter === 'ALL' || operation.operationType === filter),
    [filter, operations],
  );
  const usedPercent = balance.totalAddedHours > 0 ? Math.min(100, Math.round((balance.totalUsedHours / balance.totalAddedHours) * 100)) : 0;
  const isInitialLoading = (balanceQuery.isLoading || operationsQuery.isLoading) && !balanceQuery.data && !operationsQuery.data;
  const hasError = balanceQuery.isError || operationsQuery.isError;

  if (hasError && !balanceQuery.data && !operationsQuery.data) {
    return (
      <ErrorState
        title="Баланс не загрузился"
        description="Не удалось получить баланс или историю операций."
        onRetry={() => {
          balanceQuery.refetch();
          operationsQuery.refetch();
        }}
      />
    );
  }

  if (isInitialLoading) {
    return <BalanceSkeleton />;
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Текущий баланс</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-5xl font-black leading-none text-slate-950 transition-all duration-500 dark:text-white">{balance.balanceHours}</span>
              <span className="pb-1 text-base font-black text-slate-500 dark:text-slate-400">ч</span>
            </div>
            <p className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-300">Использовано {usedPercent}% от начисленного</p>
          </div>
          <BalanceDonut usedPercent={usedPercent} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Всего начислено" value={balance.totalAddedHours} icon={<ArrowUpCircle size={22} />} className="text-emerald-500" />
        <MetricCard label="Всего использовано" value={balance.totalUsedHours} icon={<ArrowDownCircle size={22} />} className="text-rose-500" />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">История операций</h2>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Показано: {filteredOperations.length}</p>
          </div>
          <SlidersHorizontal className="text-blue-500" size={22} />
        </div>

        <Select label="Фильтр операций" value={filter} onChange={(event) => setFilter(event.target.value as OperationFilter)}>
          <option value="ALL">Все операции</option>
          <option value="ADD">Начисление</option>
          <option value="WRITE_OFF">Списание</option>
          <option value="MANUAL_CORRECTION">Корректировка</option>
          <option value="EXPIRED">Сгорание часов</option>
        </Select>

        <div className="mt-4 grid gap-2">
          {filteredOperations.length === 0 ? (
            <EmptyState title="Операций нет" description="История появится после начисления, списания или корректировки часов." />
          ) : (
            filteredOperations.map((operation, index) => <OperationRow key={operation.id} operation={operation} index={index} />)
          )}
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
      <p className="text-3xl font-black text-slate-950 transition-all duration-500 dark:text-white">{value}</p>
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
          className="transition-all duration-700 ease-out"
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
          <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">использовано</p>
        </div>
      </div>
    </div>
  );
}

function OperationRow({ operation, index }: { operation: BalanceOperation; index: number }) {
  const style = resolveOperationStyle(operation);
  const Icon = style.icon;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[20px] bg-white/65 p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white/80 dark:bg-slate-900/60 dark:hover:bg-slate-900/80"
      style={{ animation: `fadeIn 260ms ease-out ${index * 35}ms both` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[16px] ${style.bg} ${style.text}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-black text-slate-900 dark:text-white">{operation.reason}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={style.tone}>{style.label}</Badge>
            <span className="text-xs font-bold text-slate-400">{new Date(operation.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>
      </div>
      <span className={`shrink-0 text-xl font-black ${style.text}`}>
        {operation.hours > 0 ? '+' : ''}
        {operation.hours}
      </span>
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-5">
          <div className="grid flex-1 gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-28 w-28 rounded-full" />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonCard rows={1} />
        <SkeletonCard rows={1} />
      </div>
      <SkeletonCard rows={5} />
    </>
  );
}

function resolveOperationStyle(operation: BalanceOperation) {
  if (operation.operationType === 'ADD') {
    return {
      label: getOperationTypeLabel(operation.operationType),
      tone: 'success' as const,
      bg: 'bg-emerald-100 dark:bg-emerald-950',
      text: 'text-emerald-500',
      icon: ArrowUpCircle,
    };
  }

  if (operation.operationType === 'WRITE_OFF') {
    return {
      label: getOperationTypeLabel(operation.operationType),
      tone: 'danger' as const,
      bg: 'bg-rose-100 dark:bg-rose-950',
      text: 'text-rose-500',
      icon: ArrowDownCircle,
    };
  }

  if (operation.operationType === 'EXPIRED') {
    return {
      label: getOperationTypeLabel(operation.operationType),
      tone: 'neutral' as const,
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-500',
      icon: CircleSlash,
    };
  }

  return {
    label: getOperationTypeLabel(operation.operationType),
    tone: 'info' as const,
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-500',
    icon: RotateCw,
  };
}
