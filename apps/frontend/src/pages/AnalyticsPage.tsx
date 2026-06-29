import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Bell, Calendar, ChevronLeft, ChevronRight,
  Clock, Crown, Download, FileSpreadsheet, Loader2, Menu, TrendingUp, TriangleAlert, Users, X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  BarChart, Bar as ReBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Cell, ReferenceLine,
} from 'recharts';
import { api } from '../shared/api';
import { getAccessToken } from '../shared/api/client';
import { useDashboard } from '../shared/hooks/useDashboard';
import { showAppToast } from '../shared/utils';
import type { WorkloadAnalyticsResponse, WorkloadEmployeeDetail } from '../shared/types';
import { Navigate, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const RISK_COLORS: Record<string, string> = { NORMAL: '#22c55e', WARNING: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
const RISK_BG: Record<string, string> = { NORMAL: 'bg-emerald-500/10', WARNING: 'bg-amber-500/10', HIGH: 'bg-orange-500/10', CRITICAL: 'bg-rose-500/10' };
const RISK_TEXT: Record<string, string> = { NORMAL: 'text-emerald-400', WARNING: 'text-amber-400', HIGH: 'text-orange-400', CRITICAL: 'text-rose-400' };
const RISK_LABEL: Record<string, string> = { NORMAL: 'Норма', WARNING: 'Повышенная', HIGH: 'Перегруз', CRITICAL: 'Критично' };

const MENU_ITEMS = [
  { section: 'ОБЗОР', items: [{ label: 'Дашборд', icon: BarChart3, path: '/' }] },
  { section: 'ЗАЯВКИ', items: [
    { label: 'Мои заявки', icon: FileSpreadsheet, path: '/requests/my' },
    { label: 'Команда', icon: Users, path: '/requests/manager' },
    { label: 'Календарь', icon: Calendar, path: '/calendar' },
  ]},
  { section: 'БАЛАНС', items: [{ label: 'Баланс', icon: Clock, path: '/balance' }] },
  { section: 'ОРГАНИЗАЦИЯ', items: [
    { label: 'Сотрудники', icon: Users, path: '/team' },
    { label: 'Команды', icon: Users, path: '/team' },
  ]},
  { section: 'АНАЛИТИКА', items: [
    { label: 'Аналитика нагрузки', icon: BarChart3, path: '/analytics', active: true },
    { label: 'Отчёты', icon: FileSpreadsheet, path: '/analytics' },
  ]},
  { section: 'АДМИНИСТРИРОВАНИЕ', items: [
    { label: 'Пользователи', icon: Users, path: '/admin' },
    { label: 'Настройки', icon: BarChart3, path: '/admin' },
    { label: 'Справочники', icon: FileSpreadsheet, path: '/admin' },
    { label: 'Журналы', icon: FileSpreadsheet, path: '/admin' },
  ]},
];

function getPeriodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === 'week') { const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return { from: fmt(start), to: fmt(now) }; }
  if (period === 'month') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (period === 'quarter') { const q = Math.floor(now.getMonth() / 3); return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) }; }
  return { from: fmt(now), to: fmt(now) };
}

const DEFAULT_RANGE = getPeriodRange('month');

function formatDate(d: string) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function AnalyticsPage() {
  const { dashboard } = useDashboard();
  const navigate = useNavigate();
  const canView = ['ADMIN', 'MANAGER', 'LEAD'].includes(dashboard.user.role);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(DEFAULT_RANGE.from);
  const [customTo, setCustomTo] = useState(DEFAULT_RANGE.to);
  const [showCustom, setShowCustom] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loadType, setLoadType] = useState('OVERTIME');
  const [unit, setUnit] = useState('HOURS');
  const [appliedFilters, setAppliedFilters] = useState({ from: DEFAULT_RANGE.from, to: DEFAULT_RANGE.to, teamId: '', employeeId: '', status: 'ALL', loadType: 'OVERTIME', unit: 'HOURS' });

  const [detailEmployee, setDetailEmployee] = useState<WorkloadEmployeeDetail | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    if (period === 'custom') return { from: customFrom, to: customTo };
    return getPeriodRange(period);
  }, [period, customFrom, customTo]);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];
  const teamOptions = [{ id: '', name: 'Все команды' }, ...teams.map((t: any) => ({ id: t.id, name: t.name }))];

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'workload', appliedFilters],
    queryFn: () => api.getWorkloadAnalytics({
      dateFrom: appliedFilters.from, dateTo: appliedFilters.to,
      teamId: appliedFilters.teamId || undefined,
      employeeId: appliedFilters.employeeId || undefined,
      status: appliedFilters.status,
      loadType: appliedFilters.loadType,
      unit: appliedFilters.unit,
    }),
    enabled: canView,
  });

  const data = analyticsQuery.data as WorkloadAnalyticsResponse | undefined;

  const detailQuery = useQuery({
    queryKey: ['analytics', 'user', detailUserId],
    queryFn: () => api.analyticsUserDetail(detailUserId!),
    enabled: !!detailUserId,
  });

  const applyFilters = () => {
    setAppliedFilters({
      from: dateRange.from, to: dateRange.to,
      teamId, employeeId, status, loadType, unit,
    });
  };

  const resetFilters = () => {
    const def = getPeriodRange('month');
    setPeriod('month'); setShowCustom(false);
    setCustomFrom(def.from); setCustomTo(def.to);
    setTeamId(''); setEmployeeId(''); setStatus('ALL'); setLoadType('OVERTIME'); setUnit('HOURS');
    setAppliedFilters({ from: def.from, to: def.to, teamId: '', employeeId: '', status: 'ALL', loadType: 'OVERTIME', unit: 'HOURS' });
  };

  const exportCsv = useCallback(async () => {
    const token = getAccessToken();
    const qs = new URLSearchParams({ dateFrom: appliedFilters.from, dateTo: appliedFilters.to });
    if (appliedFilters.teamId) qs.set('teamId', appliedFilters.teamId);
    if (appliedFilters.employeeId) qs.set('employeeId', appliedFilters.employeeId);
    try {
      const resp = await fetch(`${API_URL}/analytics/workload/export/csv?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `workload_analytics_${appliedFilters.from}_${appliedFilters.to}.csv`; a.click();
      URL.revokeObjectURL(url); showAppToast('CSV скачан');
    } catch { showAppToast('Ошибка экспорта CSV', undefined, 'error'); }
  }, [appliedFilters]);

  const exportExcel = useCallback(async () => {
    const token = getAccessToken();
    const qs = new URLSearchParams({ dateFrom: appliedFilters.from, dateTo: appliedFilters.to });
    if (appliedFilters.teamId) qs.set('teamId', appliedFilters.teamId);
    if (appliedFilters.employeeId) qs.set('employeeId', appliedFilters.employeeId);
    try {
      const resp = await fetch(`${API_URL}/analytics/workload/export/excel?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `workload_analytics_${appliedFilters.from}_${appliedFilters.to}.xlsx`; a.click();
      URL.revokeObjectURL(url); showAppToast('Excel скачан');
    } catch { showAppToast('Ошибка экспорта Excel', undefined, 'error'); }
  }, [appliedFilters]);

  const showEmployee = useCallback((emp: WorkloadEmployeeDetail) => {
    setDetailEmployee(emp);
    setDetailUserId(emp.employeeId);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailEmployee(null);
    setDetailUserId(null);
  }, []);

  const riskStats = useMemo(() => {
    const r = { NORMAL: 0, WARNING: 0, HIGH: 0, CRITICAL: 0 };
    if (!data?.employeeLoad) return r;
    for (const e of data.employeeLoad) r[e.riskLevel]++;
    return r;
  }, [data?.employeeLoad]);

  if (!canView) return <Navigate to="/" replace />;

  const s = data?.summary;
  const isLoading = analyticsQuery.isLoading;

  const CustomDayTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-[#0D1425] border border-[#1E2D45] rounded-xl px-4 py-3 shadow-2xl min-w-[240px]">
        <p className="text-[14px] font-bold text-white mb-2">{formatDate(d.date)}</p>
        <div className="space-y-1.5 text-[12px]">
          <p className="text-white/80">Всего: <b className="text-white">{d.totalHours} ч</b></p>
          <p className="text-white/50">Сотрудников: {d.employeesCount}</p>
          {d.pendingRequestsCount > 0 && <p className="text-amber-400">Ожидает согласования: {d.pendingRequestsCount} заявки</p>}
          {d.topEmployees?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/[0.06]">
              <p className="text-[11px] text-white/40 mb-1.5">Топ:</p>
              {d.topEmployees.slice(0, 3).map((u: any) => (
                <p key={u.employeeId} className="text-[12px] text-white/70 leading-5">{u.fullName.split(' ')[0]} {u.fullName.split(' ')[1] ?? ''}: <b>{u.hours} ч</b></p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#060D18] text-white overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-[220px] shrink-0 bg-[#091020] border-r border-[#1A2942] flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-[#1A2942] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] flex items-center justify-center text-white font-bold text-sm">Q</div>
            <span className="text-[15px] font-bold text-white">QA TimeOff</span>
          </div>
          <div className="flex-1 py-3 space-y-4">
            {MENU_ITEMS.map((section) => (
              <div key={section.section}>
                <p className="px-4 text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1">{section.section}</p>
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors ${
                      item.active
                        ? 'bg-[#4C7DFF]/15 text-[#4C7DFF] font-semibold border-r-2 border-[#4C7DFF]'
                        : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <item.icon size={15} />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-[#1A2942]">
            <button type="button" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 text-[13px] text-[#94A3B8] hover:text-white">
              <Menu size={15} /> Свернуть меню
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[#1A2942] bg-[#091020]/80">
          <div className="flex items-center gap-3">
            {!sidebarOpen && <button type="button" onClick={() => setSidebarOpen(true)} className="text-[#94A3B8] hover:text-white"><Menu size={18} /></button>}
            <div>
              <h1 className="text-[20px] font-bold text-white">Аналитика нагрузки</h1>
              <p className="text-[13px] text-[#94A3B8]">Анализ переработок и загрузки сотрудников</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={exportCsv} disabled={!data} className="flex items-center gap-1.5 rounded-lg border border-[#1E2D45] px-3 py-1.5 text-[12px] text-[#94A3B8] hover:text-white hover:border-white/20 transition-colors">
              <Download size={13} /> CSV
            </button>
            <button type="button" onClick={exportExcel} disabled={!data} className="flex items-center gap-1.5 rounded-lg border border-[#1E2D45] px-3 py-1.5 text-[12px] text-[#94A3B8] hover:text-white hover:border-white/20 transition-colors">
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button type="button" className="relative p-1.5 text-[#94A3B8] hover:text-white">
              <Bell size={17} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">{s?.pendingRequests?.count ?? 0}</span>
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-[#1A2942]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] flex items-center justify-center text-[11px] font-bold">КЕ</div>
              <div>
                <p className="text-[13px] font-semibold text-white leading-tight">{dashboard.user.fullName}</p>
                <p className="text-[11px] text-[#94A3B8] leading-tight">{dashboard.user.role === 'ADMIN' ? 'Администратор' : dashboard.user.role === 'MANAGER' ? 'Менеджер' : 'Руководитель'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Filters */}
          <div className="rounded-xl bg-[#0F1929] border border-[#1E2D45] p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="field-shell">
                <span className="field-label">Период</span>
                <select value={period} onChange={e => { setPeriod(e.target.value); setShowCustom(e.target.value === 'custom'); }} className="field-input text-[13px]">
                  <option value="today">Сегодня</option>
                  <option value="week">Неделя</option>
                  <option value="month">Месяц</option>
                  <option value="quarter">Квартал</option>
                  <option value="custom">Произвольный...</option>
                </select>
              </div>
              {showCustom && (
                <>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="field-input text-[13px]" />
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="field-input text-[13px]" />
                </>
              )}
              {!showCustom && (
                <div className="flex items-center gap-2 pb-2">
                  <span className="text-[13px] text-[#94A3B8]">{formatDate(dateRange.from)} — {formatDate(dateRange.to)}</span>
                </div>
              )}
              <div className="field-shell">
                <span className="field-label">Команда</span>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="field-input text-[13px]">
                  {teamOptions.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field-shell">
                <span className="field-label">Сотрудник</span>
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="field-input text-[13px]">
                  <option value="">Все сотрудники</option>
                  {data?.employeeLoad?.map(e => <option key={e.employeeId} value={e.employeeId}>{e.shortName}</option>)}
                </select>
              </div>
              <div className="field-shell">
                <span className="field-label">Статус</span>
                <select value={status} onChange={e => setStatus(e.target.value)} className="field-input text-[13px]">
                  <option value="ALL">Все статусы</option>
                  <option value="APPROVED">Согласовано</option>
                  <option value="PENDING">Ожидает</option>
                  <option value="REJECTED">Отклонено</option>
                  <option value="CANCELLED">Отменено</option>
                </select>
              </div>
              <div className="field-shell">
                <span className="field-label">Тип нагрузки</span>
                <select value={loadType} onChange={e => setLoadType(e.target.value)} className="field-input text-[13px]">
                  <option value="OVERTIME">Переработки</option>
                  <option value="TIMEOFF">Отгулы</option>
                  <option value="ALL">Все типы</option>
                </select>
              </div>
              <div className="field-shell">
                <span className="field-label">Единица</span>
                <select value={unit} onChange={e => setUnit(e.target.value)} className="field-input text-[13px]">
                  <option value="HOURS">Часы</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <button type="button" onClick={applyFilters} className="rounded-lg bg-[#4C7DFF] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#3B6AE8] transition-colors">Применить</button>
                <button type="button" onClick={resetFilters} className="text-[13px] text-[#94A3B8] hover:text-white transition-colors">Сбросить</button>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-[#4C7DFF]" />
            </div>
          )}

          {analyticsQuery.isError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-6 text-center">
              <TriangleAlert size={32} className="mx-auto mb-3 text-rose-400" />
              <p className="text-[15px] text-rose-300 font-semibold">Ошибка загрузки аналитики</p>
              <button type="button" onClick={() => analyticsQuery.refetch()} className="mt-3 text-[13px] text-[#4C7DFF] hover:underline">Повторить</button>
            </div>
          )}

          {data && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { icon: Clock, color: 'text-amber-400', label: 'Всего переработок', value: `${s?.totalOvertimeHours ?? 0} ч` },
                  { icon: Users, color: 'text-rose-400', label: 'Сотрудников с перегрузом', value: `${s?.overloadedEmployeesCount ?? 0} из ${s?.activeEmployeesCount ?? 0}`, sub: `${s?.activeEmployeesCount && s?.overloadedEmployeesCount && s.activeEmployeesCount > 0 ? Math.round(s.overloadedEmployeesCount / s.activeEmployeesCount * 100) : 0}% от команды` },
                  { icon: TrendingUp, color: 'text-[#4C7DFF]', label: 'Средняя нагрузка', value: `${s?.averageOvertimePerEmployee ?? 0} ч`, sub: 'на сотрудника' },
                  { icon: Crown, color: 'text-emerald-400', label: 'Самый перегруженный', value: s?.topEmployee?.fullName ?? '—', sub: s?.topEmployee ? `${s.topEmployee.hours} ч` : '', badge: s?.topEmployee?.riskLevel ? RISK_LABEL[s.topEmployee.riskLevel] ?? '' : '' },
                  { icon: Calendar, color: 'text-purple-400', label: 'Пиковый день', value: s?.peakDay ? formatDate(s.peakDay.date) : '—', sub: s?.peakDay ? `${s.peakDay.hours} ч` : '', sub2: s?.peakDay?.percentOfTotal ? `${s.peakDay.percentOfTotal}% от всей нагрузки` : '' },
                  { icon: Clock, color: 'text-amber-400', label: 'Ожидают согласования', value: `${s?.pendingRequests?.count ?? 0} заявок`, sub: `${s?.pendingRequests?.hours ?? 0} ч` },
                ].map((card, i) => (
                  <div key={i} className="rounded-xl bg-[#0F1929] border border-[#1E2D45] p-3.5 flex flex-col">
                    <card.icon size={14} className={`${card.color} mb-1.5`} />
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">{card.label}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{card.value}</p>
                    {card.sub && <p className="text-[11px] text-[#64748B] mt-0.5">{card.sub}</p>}
                    {card.sub2 && <p className="text-[11px] text-[#64748B]">{card.sub2}</p>}
                    {card.badge && <span className={`mt-1 self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${RISK_BG[card.badge.toUpperCase()] ?? 'bg-rose-500/15'} ${RISK_TEXT[card.badge.toUpperCase()] ?? 'text-rose-400'}`}>{card.badge}</span>}
                  </div>
                ))}
              </div>

              {/* Risk indicator + Recommendations */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-3 rounded-xl bg-[#0F1929] border border-[#1E2D45] p-4">
                  <h3 className="text-[13px] font-bold text-white mb-3">Индикатор риска перегруза</h3>
                  <div className="flex h-8 rounded-full overflow-hidden mb-3">
                    <div className="flex-1 bg-emerald-500/30 flex items-center justify-center text-[11px] font-semibold text-emerald-300 border-r border-[#0F1929]/50">0–8 ч</div>
                    <div className="flex-1 bg-amber-500/30 flex items-center justify-center text-[11px] font-semibold text-amber-300 border-r border-[#0F1929]/50">8–16 ч</div>
                    <div className="flex-1 bg-orange-500/30 flex items-center justify-center text-[11px] font-semibold text-orange-300 border-r border-[#0F1929]/50">16–32 ч</div>
                    <div className="flex-1 bg-rose-500/30 flex items-center justify-center text-[11px] font-semibold text-rose-300">32+ ч</div>
                  </div>
                  <div className="flex gap-4 text-[11px] text-[#64748B] mb-3">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" /> Норма: {riskStats.NORMAL}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" /> Повышена: {riskStats.WARNING}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1" /> Перегруз: {riskStats.HIGH}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" /> Критично: {riskStats.CRITICAL}</span>
                  </div>
                  {data.risk.criticalEmployees.length > 0 && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-2">
                      <p className="text-[12px] font-bold text-rose-400 mb-1.5">Критический риск</p>
                      {data.risk.criticalEmployees.map(ce => (
                        <p key={ce.employeeId} className="text-[12px] text-white/70">· {ce.fullName} — {ce.hours} ч</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[12px] text-[#64748B] italic mt-2">Рекомендация: перераспределите задачи или запланируйте компенсационный отгул.</p>
                </div>

                <div className="lg:col-span-2 rounded-xl bg-[#0F1929] border border-[#1E2D45] p-4">
                  <h3 className="text-[13px] font-bold text-white mb-3">Рекомендации системы</h3>
                  <div className="space-y-2.5">
                    {data.recommendations.slice(0, 4).map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                          r.severity === 'HIGH' ? 'bg-rose-500' : r.severity === 'WARNING' ? 'bg-amber-500' : 'bg-[#4C7DFF]'
                        }`} />
                        <div>
                          <p className="text-[12px] text-white/80 font-semibold">{r.title}</p>
                          <p className="text-[11px] text-[#64748B]">{r.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#0F1929] border border-[#1E2D45] p-4">
                  <h3 className="text-[13px] font-bold text-white mb-3">Нагрузка по дням</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.dailyLoad} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip content={<CustomDayTooltip />} />
                      <ReBar dataKey="totalHours" fill="#4C7DFF" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Норма: 80 ч/день', fill: '#22c55e', fontSize: 10, position: 'right' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl bg-[#0F1929] border border-[#1E2D45] p-4">
                  <h3 className="text-[13px] font-bold text-white mb-3">Нагрузка по сотрудникам (ТОП-10)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart layout="vertical" data={data.employeeLoad.slice(0, 10)} margin={{ top: 4, right: 50, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis type="category" dataKey="shortName" width={110} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip
                        contentStyle={{ background: '#0D1425', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                        itemStyle={{ color: '#4C7DFF', fontSize: 12 }}
                        formatter={(value: any, name: any, props: any) => [`${value} ч`, props.payload.fullName]}
                      />
                      <ReferenceLine x={16} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Норма 16 ч', fill: '#22c55e', fontSize: 10 }} />
                      <ReBar dataKey="totalHours" radius={[0, 3, 3, 0]} maxBarSize={14}>
                        {data.employeeLoad.slice(0, 10).map((entry, idx) => (
                          <Cell key={idx} fill={RISK_COLORS[entry.riskLevel] ?? '#4C7DFF'} cursor="pointer" onClick={() => showEmployee(entry)} />
                        ))}
                      </ReBar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detail table */}
              <div className="rounded-xl bg-[#0F1929] border border-[#1E2D45]">
                <div className="px-4 py-3 border-b border-[#1E2D45]">
                  <h3 className="text-[13px] font-bold text-white">Детализация нагрузки</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[#1E2D45] text-[11px] font-bold text-[#64748B] uppercase">
                        <th className="py-2.5 px-3 text-left">Сотрудник</th>
                        <th className="py-2.5 px-3 text-left">Команда</th>
                        <th className="py-2.5 px-3 text-right">Всего</th>
                        <th className="py-2.5 px-3 text-right">Согл.</th>
                        <th className="py-2.5 px-3 text-right">Ожид.</th>
                        <th className="py-2.5 px-3 text-right">Откл.</th>
                        <th className="py-2.5 px-3 text-right">Заявок</th>
                        <th className="py-2.5 px-3 text-right">Пик</th>
                        <th className="py-2.5 px-3 text-right">Баланс</th>
                        <th className="py-2.5 px-3 text-center">Риск</th>
                        <th className="py-2.5 px-3 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.employeeLoad.slice(0, 10).map(e => (
                        <tr key={e.employeeId} className="border-b border-[#1E2D45]/50 hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => showEmployee(e)}>
                          <td className="py-2.5 px-3 text-white/90 font-semibold">{e.shortName}</td>
                          <td className="py-2.5 px-3 text-[#64748B]">{e.teamName ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right text-white font-semibold">{e.totalHours}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400">{e.approvedHours}</td>
                          <td className="py-2.5 px-3 text-right text-amber-400">{e.pendingHours}</td>
                          <td className="py-2.5 px-3 text-right text-[#64748B]">{e.rejectedHours}</td>
                          <td className="py-2.5 px-3 text-right text-[#64748B]">{e.requestsCount}</td>
                          <td className="py-2.5 px-3 text-right text-[#64748B] text-[11px]">{e.peakDay ? `${formatDate(e.peakDay.date)} (${e.peakDay.hours} ч)` : '—'}</td>
                          <td className="py-2.5 px-3 text-right text-[#64748B]">{e.timeOffBalanceHours} ч</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${RISK_BG[e.riskLevel]} ${RISK_TEXT[e.riskLevel]}`}>{RISK_LABEL[e.riskLevel]}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button type="button" onClick={e2 => { e2.stopPropagation(); showEmployee(e); }} className="text-[#4C7DFF] text-[11px] hover:underline">→</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1E2D45]">
                  <p className="text-[11px] text-[#64748B]">Показано 1–{Math.min(data.employeeLoad.length, 10)} из {data.employeeLoad.length}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-1 text-[#64748B] hover:text-white disabled:opacity-30" disabled><ChevronLeft size={14} /></button>
                    <span className="text-[12px] text-white font-semibold">1</span>
                    {data.employeeLoad.length > 10 && <span className="text-[12px] text-[#64748B]">2</span>}
                    <button type="button" className="p-1 text-[#64748B] hover:text-white disabled:opacity-30" disabled={data.employeeLoad.length <= 10}><ChevronRight size={14} /></button>
                  </div>
                </div>
              </div>
            </>
          )}

          {!isLoading && !analyticsQuery.isError && !data && (
            <div className="rounded-xl bg-[#0F1929] border border-[#1E2D45] p-10 text-center">
              <BarChart3 size={40} className="mx-auto mb-3 text-[#64748B]" />
              <p className="text-[15px] text-[#64748B]">Выберите период и нажмите «Применить»</p>
            </div>
          )}
        </div>
      </div>

      {/* Employee detail panel */}
      {(detailEmployee || detailUserId) && (
        <div className="w-[360px] shrink-0 bg-[#091020] border-l border-[#1A2942] overflow-y-auto">
          <div className="sticky top-0 bg-[#091020] border-b border-[#1A2942] px-5 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-white">{detailEmployee?.fullName ?? 'Загрузка...'}</p>
              <p className="text-[12px] text-[#64748B]">{detailEmployee?.teamName ? `Команда ${detailEmployee.teamName}` : ''}</p>
            </div>
            <button type="button" onClick={closeDetail} className="p-1 rounded-lg hover:bg-white/[0.06]"><X size={15} className="text-[#64748B]" /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* Avatar + role */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] flex items-center justify-center text-[14px] font-bold">{detailEmployee?.fullName?.split(' ').map(s => s[0]).join('').slice(0, 2) ?? '?'}</div>
              <div>
                <p className="text-[14px] font-semibold text-white">{detailEmployee?.fullName}</p>
                <p className="text-[12px] text-[#64748B]">{detailEmployee?.position ?? 'Сотрудник'}</p>
                <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${detailEmployee ? RISK_BG[detailEmployee.riskLevel] : ''} ${detailEmployee ? RISK_TEXT[detailEmployee.riskLevel] : ''}`}>
                  {detailEmployee ? RISK_LABEL[detailEmployee.riskLevel] : ''}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            {detailEmployee && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Всего', value: `${detailEmployee.totalHours} ч`, color: '' },
                    { label: 'Согласовано', value: `${detailEmployee.approvedHours} ч`, color: 'text-emerald-400' },
                    { label: 'Ожидает', value: `${detailEmployee.pendingHours} ч`, color: 'text-amber-400' },
                    { label: 'Отклонено', value: `${detailEmployee.rejectedHours} ч`, color: 'text-rose-400' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-lg bg-[#0F1929] border border-[#1E2D45] p-2.5">
                      <p className="text-[10px] text-[#64748B]">{s.label}</p>
                      <p className={`text-[14px] font-bold ${s.color || 'text-white'}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#0F1929] border border-[#1E2D45] p-2.5">
                    <p className="text-[10px] text-[#64748B]">Заявок</p>
                    <p className="text-[14px] font-bold text-white">{detailEmployee.requestsCount}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1929] border border-[#1E2D45] p-2.5">
                    <p className="text-[10px] text-[#64748B]">Пиковый день</p>
                    <p className="text-[13px] font-bold text-white">{detailEmployee.peakDay ? `${formatDate(detailEmployee.peakDay.date)} (${detailEmployee.peakDay.hours} ч)` : '—'}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1929] border border-[#1E2D45] p-2.5">
                    <p className="text-[10px] text-[#64748B]">Последний отгул</p>
                    <p className="text-[13px] font-bold text-white">{detailEmployee.lastTimeOffDate ? formatDate(detailEmployee.lastTimeOffDate) : '—'}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1929] border border-[#1E2D45] p-2.5">
                    <p className="text-[10px] text-[#64748B]">Баланс отгулов</p>
                    <p className="text-[14px] font-bold text-[#4C7DFF]">{detailEmployee.timeOffBalanceHours} ч</p>
                  </div>
                </div>

                {/* Weekly trend chart */}
                {detailEmployee.weeklyTrend.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-[#64748B] uppercase mb-2">Динамика за последние 4 недели</p>
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={detailEmployee.weeklyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748B' }} tickFormatter={(v: string) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748B' }} />
                        <Line type="monotone" dataKey="hours" stroke="#4C7DFF" strokeWidth={2} dot={{ r: 2, fill: '#4C7DFF' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* CTA */}
                <button type="button" disabled className="w-full rounded-lg bg-gradient-to-r from-[#4C7DFF] to-[#7C5CFF] py-3 text-[13px] font-bold text-white/60 cursor-not-allowed">Перейти к заявкам сотрудника</button>
              </>
            )}

            {detailQuery.isLoading && (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#4C7DFF]" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
