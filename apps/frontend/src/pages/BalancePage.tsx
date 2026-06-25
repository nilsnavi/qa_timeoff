import { useQuery } from '@tanstack/react-query';
import { Clock, History as HistoryIcon, Plus, TrendingUp, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ErrorState, Skeleton } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import { getRoleLabel } from '../shared/utils';

// ─── Types ──────────────────────────────────────────────────────────────
interface HistoryEntry {
  date: string;
  balance: number;
  accrued: number;
  used: number;
}

interface LedgerEntry {
  id: string;
  type: 'overtime' | 'leave' | 'adjustment';
  value: number;
  status: 'pending' | 'approved';
  createdBy: string;
  timestamp: string;
  comment: string;
}

interface LedgerResponse {
  items: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
}

interface SummaryResponse {
  accruedHours: number;
  usedHours: number;
  overtimeMultiplier: number;
  pendingRequests: number;
  overtimeHours: number;
  leaveHours: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function formatTS(ts: string) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Main Component ─────────────────────────────────────────────────────
export function BalancePage() {
  const { dashboard } = useDashboard();
  const navigate = useNavigate();
  const user = dashboard.user;
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [chartDays, setChartDays] = useState(30);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit] = useState(20);

  // Balance query
  const balanceQuery = useQuery({
    queryKey: ['balance', 'me'],
    queryFn: api.balanceMe,
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  // History query (chart data)
  const historyQuery = useQuery({
    queryKey: ['balance', 'history', chartDays],
    queryFn: () => api.balanceHistory(chartDays),
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  // Summary query
  const summaryQuery = useQuery({
    queryKey: ['balance', 'summary'],
    queryFn: () => api.balanceSummary(),
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  // Ledger query
  const ledgerQuery = useQuery({
    queryKey: ['balance', 'ledger', ledgerPage, ledgerLimit],
    queryFn: () => api.balanceLedger(ledgerPage, ledgerLimit),
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  const balance = balanceQuery.data ?? dashboard.balance;
  const history = (historyQuery.data ?? []) as HistoryEntry[];
  const summary = summaryQuery.data as SummaryResponse | undefined;
  const ledger = ledgerQuery.data as LedgerResponse | undefined;

  const usedPercent = balance.totalAddedHours > 0
    ? Math.min(100, Math.round((balance.totalUsedHours / balance.totalAddedHours) * 100))
    : 0;

  const isInitialLoading = balanceQuery.isLoading && !balanceQuery.data;
  const hasError = balanceQuery.isError;

  if (hasError && !balanceQuery.data) {
    return (
      <ErrorState
        title="Баланс не загрузился"
        description="Не удалось получить данные баланса."
        onRetry={() => balanceQuery.refetch()}
      />
    );
  }

  if (isInitialLoading) {
    return <BalanceSkeleton />;
  }

  const initials = user.fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

  // SVG chart dimensions
  const chartW = 400;
  const chartH = 200;
  const chartPad = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartInnerW = chartW - chartPad.left - chartPad.right;
  const chartInnerH = chartH - chartPad.top - chartPad.bottom;

  // Compute chart points
  const chartData = history;
  const maxVal = Math.max(...chartData.map((d) => d.balance), 1);
  const minVal = Math.min(...chartData.map((d) => d.balance), 0);
  const range = maxVal - minVal || 1;

  const points = chartData.map((d, i) => {
    const x = chartPad.left + (i / Math.max(chartData.length - 1, 1)) * chartInnerW;
    const y = chartPad.top + chartInnerH - ((d.balance - minVal) / range) * chartInnerH;
    return `${x},${y}`;
  });

  const areaPoints = `0,${chartH - chartPad.bottom} ${points.join(' ')} ${chartW - chartPad.right},${chartH - chartPad.bottom}`;

  // Pagination
  const totalPages = ledger ? Math.ceil(ledger.total / ledger.limit) : 1;

  return (
    <div className="dashboard-grid">
      {/* ═══ LEFT COLUMN ═══ */}
      <div className="flex flex-col gap-4">

        {/* ── Main Balance Card ───────────────────────────────── */}
        <div className="enterprise-card p-6">
          <div className="flex items-center justify-between gap-8">
            <div className="min-w-0 flex-1">
              <div className="mb-2 text-[13px] font-semibold text-white/50">Текущий баланс</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[52px] font-bold text-white leading-none tabular-nums">
                  {balance.balanceHours}
                </span>
                <span className="text-[18px] font-medium text-white/40 mb-1">часов</span>
              </div>

              {/* Прогресс-бар */}
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#4C7DFF] to-emerald-400 transition-all duration-700"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <span className="text-[14px] font-semibold text-white/50 shrink-0">
                  {usedPercent}% использовано
                </span>
              </div>

              {/* Мета-строка */}
              <div className="mt-3 flex items-center gap-5">
                <span className="text-[14px] text-white/40">
                  Начислено:{' '}
                  <strong className="text-white/75">{balance.totalAddedHours} ч</strong>
                </span>
                <span className="text-[14px] text-white/40">
                  Использовано:{' '}
                  <strong className="text-white/75">{balance.totalUsedHours} ч</strong>
                </span>
              </div>
            </div>

            {/* Кольцо */}
            <RingProgress percent={usedPercent} size={130} />
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Начислено */}
          <div className="enterprise-card p-5 hover-lift">
            <div className="mb-2 text-[13px] font-semibold text-white/50">Всего начислено</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-bold text-emerald-400 leading-none">
                {summary?.accruedHours ?? balance.totalAddedHours}
              </span>
              <span className="text-[16px] font-medium text-white/40">ч</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-white/35">
              <TrendingUp size={14} />
              <span>включая переработки ×{summary?.overtimeMultiplier ?? 1.5}</span>
            </div>
          </div>

          {/* Использовано */}
          <div className="enterprise-card p-5 hover-lift">
            <div className="mb-2 text-[13px] font-semibold text-white/50">Всего использовано</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-bold text-rose-400 leading-none">
                {summary?.usedHours ?? balance.totalUsedHours}
              </span>
              <span className="text-[16px] font-medium text-white/40">ч</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-white/35">
              <Clock size={14} />
              <span>отгулы + отпуска</span>
            </div>
          </div>
        </div>

        {/* ── Chart ────────────────────────────────────────────── */}
        <div className="enterprise-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[14px] font-semibold text-white/50">Динамика баланса</span>
            <div className="flex gap-1.5">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setChartDays(d)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    chartDays === d
                      ? 'bg-[#4C7DFF]/20 text-[#4C7DFF]'
                      : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  {d === 7 ? '7д' : d === 30 ? 'Мес' : d === 90 ? 'Кв' : 'Год'}
                </button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-[14px] text-white/35">Нет данных за выбранный период</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[200px]">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = chartPad.top + chartInnerH - frac * chartInnerH;
                const val = Math.round(minVal + frac * range);
                return (
                  <g key={frac}>
                    <line x1={chartPad.left} y1={y} x2={chartW - chartPad.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                    <text x={chartPad.left - 4} y={y + 3} textAnchor="end" className="fill-white/30" style={{ fontSize: '11px' }}>{val}</text>
                  </g>
                );
              })}
              {/* Area fill */}
              <polygon points={areaPoints} fill="url(#balanceChartGrad)" opacity={0.3} />
              {/* Line */}
              <polyline points={points.join(' ')} fill="none" stroke="#4C7DFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {/* Gradient def */}
              <defs>
                <linearGradient id="balanceChartGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#4C7DFF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#4C7DFF" stopOpacity={0} />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>
      </div>

      {/* ═══ RIGHT COLUMN ═══ */}
      <div className="flex flex-col gap-4">

        {/* ── Employee Info ────────────────────────────────────── */}
        <div className="enterprise-card p-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="grid h-14 w-14 place-items-center rounded-[14px] app-gradient text-[16px] font-bold text-white shadow-md">
                {initials}
              </div>
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#111A2E] bg-emerald-500" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[16px] font-bold text-white leading-tight">{user.fullName}</span>
                <Badge tone="gradient" className="text-[11px]">{getRoleLabel(user.role)}</Badge>
              </div>
              <span className="text-[13px] font-medium text-white/45 mt-0.5 block">
                {user.position ?? 'QA-команда'}
              </span>
              {user.email && (
                <span className="text-[12px] text-white/30 mt-0.5 block truncate">{user.email}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Ledger ───────────────────────────────────────────── */}
        <div className="enterprise-card p-5 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[14px] font-semibold text-white/50">Журнал операций</span>
            <span className="text-[13px] text-white/35">{ledger?.total ?? 0} записей</span>
          </div>

          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
            {!ledger || ledger.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.04]">
                  <HistoryIcon size={18} className="text-white/25" />
                </div>
                <p className="text-[14px] font-medium text-white/35">Нет операций</p>
                <p className="text-[13px] text-white/25">Операции появятся после начисления часов</p>
              </div>
            ) : (
              ledger.items.map((entry) => (
                <LedgerRow key={entry.id} entry={entry} />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-4">
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                disabled={ledgerPage <= 1}
                className="rounded-lg bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/50 hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Назад
              </button>
              <span className="text-[13px] text-white/40">Стр. {ledgerPage} из {totalPages}</span>
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                disabled={ledgerPage >= totalPages}
                className="rounded-lg bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/50 hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Вперед →
              </button>
            </div>
          )}
        </div>

        {/* ── Quick Actions ────────────────────────────────────── */}
        <div className="enterprise-card p-5">
          <div className="mb-4 text-[14px] font-semibold text-white/50">Быстрые действия</div>
          <div className="grid grid-cols-1 gap-2">
            <ActionBtn icon={Clock} label="Запросить отгул" onClick={() => navigate('/timeoff/new')} accent />
            <ActionBtn icon={HistoryIcon} label="Запросить отпуск" onClick={() => navigate('/vacation/new')} />
            {isAdmin && (
              <>
                <ActionBtn icon={UserPlus} label="Назначить часы" onClick={() => navigate('/admin')} />
                <ActionBtn icon={Plus} label="Корректировка" onClick={() => navigate('/admin')} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

/* Ring Progress */
function RingProgress({ percent, size }: { percent: number; size: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#ringGrad)" strokeLinecap="round" strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#4C7DFF" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[22px] font-bold text-white leading-tight">{percent}%</div>
          <div className="text-[11px] font-medium text-white/40">исп.</div>
        </div>
      </div>
    </div>
  );
}

/* Ledger Row */
function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const typeLabel: Record<string, string> = {
    overtime: 'Переработка',
    leave: 'Отгул / Отпуск',
    adjustment: 'Корректировка',
  };
  const typeColor: Record<string, string> = {
    overtime:   'bg-emerald-500/10 text-emerald-400',
    leave:      'bg-rose-500/10 text-rose-400',
    adjustment: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <div className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.03]">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[14px] font-bold ${typeColor[entry.type] ?? 'bg-white/5 text-white/40'}`}>
        {entry.value > 0 ? '+' : ''}{entry.value}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-white/85">
            {typeLabel[entry.type] ?? entry.type}
          </span>
          <span className={`text-[13px] font-bold ${entry.value > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {entry.value > 0 ? '+' : ''}{entry.value}ч
          </span>
        </div>
        {entry.comment && (
          <div className="truncate text-[13px] text-white/40 mt-0.5">{entry.comment}</div>
        )}
        <div className="text-[12px] text-white/25 mt-0.5">
          {entry.createdBy} · {formatTS(entry.timestamp)}
        </div>
      </div>

      <div className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        entry.status === 'approved'
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-amber-500/10 text-amber-400'
      }`}>
        {entry.status === 'approved' ? 'Одобрено' : 'Ожидает'}
      </div>
    </div>
  );
}

/* Action Button */
function ActionBtn({
  icon: Icon,
  label,
  onClick,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-left
                  transition-all border
                  ${accent
                    ? 'bg-[#4C7DFF]/12 border-[#4C7DFF]/25 text-[#6B96FF] hover:bg-[#4C7DFF]/20'
                    : 'bg-white/[0.04] border-white/[0.07] text-white/55 hover:bg-white/[0.08] hover:text-white/80'
                  }`}
    >
      <Icon size={16} className={accent ? 'text-[#4C7DFF]' : 'text-white/40'} />
      <span className="text-[14px] font-semibold">{label}</span>
    </button>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────
function BalanceSkeleton() {
  return (
    <div className="dashboard-grid">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[170px] rounded-[12px]" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[110px] rounded-[12px]" />
          <Skeleton className="h-[110px] rounded-[12px]" />
        </div>
        <Skeleton className="h-[240px] rounded-[12px]" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[80px] rounded-[12px]" />
        <Skeleton className="h-[360px] rounded-[12px]" />
        <Skeleton className="h-[110px] rounded-[12px]" />
      </div>
    </div>
  );
}
