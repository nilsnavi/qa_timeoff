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
  const chartH = 140;
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
      {/* ═══ LEFT COLUMN (70%) ═══ */}
      <div className="flex flex-col gap-3">

        {/* ── Main Balance Card (Ring progress) ──────────────── */}
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Текущий баланс</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-white tabular-nums">{balance.balanceHours}</span>
                <span className="text-sm font-semibold text-white/40">часов</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#4C7DFF] to-emerald-400 transition-all duration-700"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-white/40">{usedPercent}% использовано</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] text-white/40">
                  Начислено: <strong className="text-white/80">{balance.totalAddedHours} ч</strong>
                </span>
                <span className="text-[11px] text-white/40">
                  Использовано: <strong className="text-white/80">{balance.totalUsedHours} ч</strong>
                </span>
              </div>
            </div>
            <RingProgress percent={usedPercent} size={110} />
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="enterprise-card p-3.5 hover-lift">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Всего начислено</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-400">{summary?.accruedHours ?? balance.totalAddedHours}</span>
              <span className="text-[11px] font-medium text-white/40">ч</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30">
              <TrendingUp size={12} />
              <span>включая переработки ×{summary?.overtimeMultiplier ?? 1.5}</span>
            </div>
          </div>
          <div className="enterprise-card p-3.5 hover-lift">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Всего использовано</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-rose-400">{summary?.usedHours ?? balance.totalUsedHours}</span>
              <span className="text-[11px] font-medium text-white/40">ч</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30">
              <Clock size={12} />
              <span>отгулы + отпуска</span>
            </div>
          </div>
        </div>

        {/* ── Chart ──────────────────────────────────────────── */}
        <div className="enterprise-card p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Динамика баланса</span>
            <div className="flex gap-1">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setChartDays(d); }}
                  className={`rounded-md px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                    chartDays === d
                      ? 'bg-[#4C7DFF]/20 text-[#4C7DFF]'
                      : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  {d}д
                </button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-[140px] items-center justify-center">
              <p className="text-xs text-white/30">Нет данных за выбранный период</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[140px]">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = chartPad.top + chartInnerH - frac * chartInnerH;
                const val = Math.round(minVal + frac * range);
                return (
                  <g key={frac}>
                    <line x1={chartPad.left} y1={y} x2={chartW - chartPad.right} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                    <text x={chartPad.left - 4} y={y + 3} textAnchor="end" className="fill-white/20 text-[8px]">{val}</text>
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

      {/* ═══ RIGHT COLUMN (30%) ═══ */}
      <div className="flex flex-col gap-3">

        {/* ── Employee Info ──────────────────────────────────── */}
        <div className="enterprise-card p-3.5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="grid h-10 w-10 place-items-center rounded-[10px] app-gradient text-xs font-bold text-white shadow-sm">
                {initials}
              </div>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111A2E] bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{user.fullName}</span>
                <Badge tone="gradient" className="text-[9px]">{getRoleLabel(user.role)}</Badge>
              </div>
              <span className="text-[11px] font-medium text-white/40">{user.position ?? 'QA-команда'}</span>
            </div>
          </div>
        </div>

        {/* ── Ledger ─────────────────────────────────────────── */}
        <div className="enterprise-card p-3.5 flex-1">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Журнал операций</span>
            <span className="text-[9px] text-white/30">{ledger?.total ?? 0} записей</span>
          </div>

          <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto">
            {!ledger || ledger.items.length === 0 ? (
              <p className="text-xs text-white/30 py-4 text-center">Нет операций</p>
            ) : (
              ledger.items.map((entry) => (
                <LedgerRow key={entry.id} entry={entry} />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.04] pt-2.5">
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                disabled={ledgerPage <= 1}
                className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold text-white/50 hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Назад
              </button>
              <span className="text-[9px] text-white/30">Стр. {ledgerPage} из {totalPages}</span>
              <button
                type="button"
                onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                disabled={ledgerPage >= totalPages}
                className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold text-white/50 hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Вперед →
              </button>
            </div>
          )}
        </div>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <div className="enterprise-card p-3.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Быстрые действия</div>
          <div className="grid grid-cols-2 gap-1.5">
            <ActionBtn icon={Clock} label="Запросить отгул" onClick={() => navigate('/timeoff/new')} />
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#ringGrad)" strokeLinecap="round" strokeWidth="6"
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
          <div className="text-lg font-bold text-white">{percent}%</div>
          <div className="text-[8px] font-medium text-white/30 uppercase tracking-wider">исп.</div>
        </div>
      </div>
    </div>
  );
}

/* Ledger Row */
function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const typeLabel: Record<string, string> = { overtime: 'Переработка', leave: 'Отгул/Отпуск', adjustment: 'Корректировка' };
  const typeColor: Record<string, string> = {
    overtime: 'bg-emerald-500/10 text-emerald-400',
    leave: 'bg-rose-500/10 text-rose-400',
    adjustment: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-white/[0.03]">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${typeColor[entry.type] ?? 'bg-white/5 text-white/40'}`}>
        {entry.value > 0 ? '+' : ''}{entry.value}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-white/80">{typeLabel[entry.type] ?? entry.type}</span>
          <span className={`text-[8px] font-semibold uppercase ${entry.value > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {entry.value > 0 ? '+' : ''}{entry.value}ч
          </span>
        </div>
        <div className="truncate text-[9px] text-white/30">{entry.comment}</div>
        <div className="text-[8px] text-white/20">{entry.createdBy} · {formatTS(entry.timestamp)}</div>
      </div>
    </div>
  );
}

/* Action Button */
function ActionBtn({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-[10px] font-semibold text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white/80 active:scale-95"
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────
function BalanceSkeleton() {
  return (
    <div className="dashboard-grid">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[130px] rounded-[12px]" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[80px] rounded-[12px]" />
          <Skeleton className="h-[80px] rounded-[12px]" />
        </div>
        <Skeleton className="h-[180px] rounded-[12px]" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[60px] rounded-[12px]" />
        <Skeleton className="h-[360px] rounded-[12px]" />
        <Skeleton className="h-[80px] rounded-[12px]" />
      </div>
    </div>
  );
}
