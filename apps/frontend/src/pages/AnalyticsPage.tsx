import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Clock, Download, Loader2, TrendingUp, TriangleAlert, Users, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  BarChart, Bar as ReBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../shared/api';
import { Button, Card, CustomSelect, EmptyState, ErrorState, Field, Loader, StatusBadge } from '../components/ui';
import type { SelectOption } from '../components/ui/CustomSelect';
import { useDashboard } from '../shared/hooks/useDashboard';
import { Navigate } from 'react-router-dom';
import { showAppToast } from '../shared/utils';
import type { WorkloadUser } from '../shared/types';
import { getAccessToken } from '../shared/api/client';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

function getPeriodRange(period: string): { from: string; to: string } | undefined {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return { from: fmt(start), to: fmt(now) };
  }
  if (period === 'month') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (period === 'quarter') { const q = Math.floor(now.getMonth() / 3); return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) }; }
  return undefined;
}

const riskColors: Record<string, string> = { normal: 'text-emerald-400', increased: 'text-amber-400', overload: 'text-orange-400', critical: 'text-rose-400' };
const riskBg: Record<string, string> = { normal: 'bg-emerald-500/10', increased: 'bg-amber-500/10', overload: 'bg-orange-500/10', critical: 'bg-rose-500/10' };
const riskLabels: Record<string, string> = { normal: 'Норма', increased: 'Повышена', overload: 'Перегруз', critical: 'Критично' };

export function AnalyticsPage() {
  const { dashboard } = useDashboard();
  const canView = ['ADMIN', 'MANAGER', 'LEAD'].includes(dashboard.user.role);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [userId, setUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState<WorkloadUser | null>(null);

  const dateRange = useMemo(() => {
    if (period === 'custom') return { from: customFrom || monthAgo, to: customTo || today };
    return getPeriodRange(period) ?? { from: monthAgo, to: today };
  }, [period, customFrom, customTo, monthAgo, today]);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];
  const teamOptions: SelectOption[] = [{ value: '', label: 'Все команды' }, ...teams.map(t => ({ value: t.id, label: t.name }))];

  const reportQuery = useQuery({
    queryKey: ['admin', 'analytics', 'workload', dateRange.from, dateRange.to, teamId, userId],
    queryFn: () => api.workloadReport({ startDate: dateRange.from, endDate: dateRange.to, teamId: teamId || undefined, userId: userId || undefined }),
    enabled: !!dateRange.from && !!dateRange.to && canView,
  });

  const report = reportQuery.data;

  // ── User detail query ─────────────────────────────────────────
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ['admin', 'analytics', 'user', detailUserId],
    queryFn: () => api.analyticsUserDetail(detailUserId!),
    enabled: !!detailUserId,
  });
  type UserDetail = { user?: { fullName?: string; email?: string; team?: { name?: string } }; balance?: { balanceHours?: number; totalAddedHours?: number; totalUsedHours?: number }; overtimes?: Array<{ id: string; date: string; hours: number }>; timeOffs?: Array<{ id: string; date: string; status: string }>; vacations?: Array<{ id: string }> };
  const detail = detailQuery.data as UserDetail | undefined;

  // ── CSV export ────────────────────────────────────────────────
  const exportCsv = useCallback(async () => {
    const token = getAccessToken();
    const qs = new URLSearchParams({ startDate: dateRange.from, endDate: dateRange.to });
    if (teamId) qs.set('teamId', teamId);
    if (userId) qs.set('userId', userId);
    try {
      const resp = await fetch(`${API_URL}/admin/analytics/workload/csv?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'workload_report.csv'; a.click();
      URL.revokeObjectURL(url);
      showAppToast('Отчёт скачан');
    } catch {
      showAppToast('Ошибка экспорта', undefined, 'error');
    }
  }, [dateRange, teamId, userId]);

  // ── Risk stats ──────────────────────────────────────────────
  const riskStats = useMemo(() => {
    if (!report?.workloadByUser) return { normal: 0, increased: 0, overload: 0, critical: 0 };
    const s = { normal: 0, increased: 0, overload: 0, critical: 0 };
    for (const u of report.workloadByUser) s[u.riskLevel]++;
    return s;
  }, [report?.workloadByUser]);

  const employeeCount = report?.workloadByUser?.length ?? 0;

  if (!canView) return <Navigate to="/" replace />;

  const tooltipTheme = {
    contentStyle: { background: '#0F1724', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 },
    labelStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
    itemStyle: { color: '#4C7DFF', fontSize: 12 },
  } as const;

  const CustomDayTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-[#0F1724] border border-white/[0.08] rounded-xl px-4 py-3 shadow-2xl min-w-[200px]">
        <p className="text-[13px] font-bold text-white mb-2">{d.date}</p>
        <div className="space-y-1 text-[12px]">
          <p className="text-emerald-400">Согласовано: <b>{d.approvedHours} ч</b></p>
          {d.pendingHours > 0 && <p className="text-amber-400">Ожидает: <b>{d.pendingHours} ч</b></p>}
          <p className="text-white/50">Сотрудников: <b>{d.users?.length ?? 0}</b></p>
          {d.pendingRequests > 0 && <p className="text-rose-400">Заявок ожидают: <b>{d.pendingRequests}</b></p>}
          {d.topUsers?.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-white/[0.06]">
              <p className="text-white/40 mb-1">Топ:</p>
              {d.topUsers.slice(0, 3).map((u: any) => (
                <p key={u.name} className="text-white/70">{u.name}: <b>{u.hours} ч</b></p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Аналитика нагрузки</h1>
          <p className="text-[15px] text-white/40 mt-1">
            {dashboard.user.role === 'ADMIN' ? 'Все команды' : dashboard.user.role === 'MANAGER' ? 'Мои команды' : 'Моя команда'}
            · {report ? `${report.workloadByUser.length} сотрудников` : 'загрузка…'}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!report}>
          <Download size={14} className="mr-1" /> CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-44 field-shell">
            <span className="field-label">Период</span>
            <CustomSelect
              value={period}
              onChange={v => { setPeriod(v); setShowCustom(v === 'custom'); }}
              options={[
                { value: 'today', label: 'Сегодня' },
                { value: 'week', label: 'Неделя' },
                { value: 'month', label: 'Месяц' },
                { value: 'quarter', label: 'Квартал' },
                { value: 'custom', label: 'Произвольный...' },
              ]}
              small
            />
          </div>
          {showCustom && (
            <>
              <Field label="От" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <Field label="До" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <CustomSelect value={teamId} onChange={setTeamId} options={teamOptions} placeholder="Все команды" />
          </div>
        </div>
      </Card>

      {/* Loading / Error */}
      {reportQuery.isLoading && <Loader />}
      {reportQuery.isError && <ErrorState title="Ошибка загрузки" description="Не удалось загрузить аналитику" onRetry={() => reportQuery.refetch()} />}

      {report && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <Clock size={15} className="text-amber-400 mb-1" />
              <p className="text-[11px] font-bold text-white/30 uppercase">Всего переработок</p>
              <p className="text-xl font-bold text-white">{report.kpi.totalOvertime} ч</p>
            </Card>
            <Card>
              <TriangleAlert size={15} className="text-rose-400 mb-1" />
              <p className="text-[11px] font-bold text-white/30 uppercase">С перегрузом</p>
              <p className="text-xl font-bold text-rose-400">{report.kpi.overloadedCount}</p>
            </Card>
            <Card>
              <BarChart3 size={15} className="text-[#4C7DFF] mb-1" />
              <p className="text-[11px] font-bold text-white/30 uppercase">Средняя нагрузка</p>
              <p className="text-xl font-bold text-white">{report.kpi.avgLoad} ч</p>
            </Card>
            <Card>
              <Users size={15} className="text-emerald-400 mb-1" />
              <p className="text-[11px] font-bold text-white/30 uppercase">Топ сотрудник</p>
              <p className="text-[14px] font-bold text-white truncate">{report.kpi.topUser?.fullName ?? '—'}</p>
            </Card>
            <Card>
              <TrendingUp size={15} className="text-purple-400 mb-1" />
              <p className="text-[11px] font-bold text-white/30 uppercase">Пик нагрузки</p>
              <p className="text-[13px] font-bold text-white">{report.kpi.peakDay?.date?.slice(5) ?? '—'}</p>
            </Card>
            <Card>
              <Clock size={15} className="text-amber-400 mb-1" />
              <p className="text-[11px] font-bold text-white/30 uppercase">Ожидают</p>
              <p className="text-xl font-bold text-amber-400">{report.kpi.pendingRequests}</p>
            </Card>
          </div>

          {/* Risk distribution */}
          <div className="flex gap-2 flex-wrap">
            {(['normal', 'increased', 'overload', 'critical'] as const).map(r => (
              <div key={r} className={`flex items-center gap-1.5 rounded-full ${riskBg[r]} px-3 py-1 text-[12px] font-semibold ${riskColors[r]}`}>
                {riskLabels[r]}: {riskStats[r]}
              </div>
            ))}
          </div>

          {/* Anomaly warning */}
          {report.anomalyWarning && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-300">{report.anomalyWarning}</p>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Рекомендации</span>
              <div className="space-y-2">
                {report.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[13px]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#4C7DFF] mt-2 shrink-0" />
                    <span className="text-white/70">{r}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Workload by day */}
          {report.workloadByDay.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Нагрузка по дням</span>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={report.workloadByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip content={<CustomDayTooltip />} />
                  <ReBar dataKey="approvedHours" name="Согласовано" fill="#4C7DFF" radius={[3, 3, 0, 0]} maxBarSize={24} stackId="a" />
                  <ReBar dataKey="pendingHours" name="Ожидает" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={24} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Detail table */}
          {report.workloadByUser.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Детализация по сотрудникам</span>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-[11px] font-bold text-white/30 uppercase">
                      <th className="py-2 pr-2 text-left">Сотрудник</th>
                      <th className="py-2 px-2 text-left">Команда</th>
                      <th className="py-2 px-2 text-right">Всего</th>
                      <th className="py-2 px-2 text-right">Согл.</th>
                      <th className="py-2 px-2 text-right">Ожид.</th>
                      <th className="py-2 px-2 text-right">Заявок</th>
                      <th className="py-2 px-2 text-right">Баланс</th>
                      <th className="py-2 px-2 text-center">Риск</th>
                      <th className="py-2 pl-2 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {report.workloadByUser.map((u) => (
                      <tr
                        key={u.userId}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => { setDetailUserId(u.userId); setSelectedUser(u); }}
                      >
                        <td className="py-2.5 pr-2 text-white/80 font-semibold">{u.fullName}</td>
                        <td className="py-2.5 px-2 text-white/40">{u.teamName}</td>
                        <td className="py-2.5 px-2 text-right text-white font-semibold">{u.totalHours}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-400">{u.approvedHours}</td>
                        <td className="py-2.5 px-2 text-right text-amber-400">{u.pendingHours}</td>
                        <td className="py-2.5 px-2 text-right text-white/60">{u.requestCount}</td>
                        <td className="py-2.5 px-2 text-right text-white/60">{u.balanceHours}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${riskBg[u.riskLevel]} ${riskColors[u.riskLevel]}`}>
                            {riskLabels[u.riskLevel]}
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <button type="button" className="text-[#4C7DFF] text-[11px] hover:underline" onClick={e => { e.stopPropagation(); setDetailUserId(u.userId); setSelectedUser(u); }}>
                            Детали
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {report.workloadByUser.length === 0 && (
            <EmptyState title="Нет данных" description="За выбранный период данные отсутствуют" />
          )}
        </>
      )}

      {!reportQuery.isLoading && !reportQuery.isError && !report && (
        <EmptyState title="Выберите период" description="Настройте фильтры для загрузки аналитики" />
      )}

      {/* User detail panel */}
      {(selectedUser || detailUserId) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDetailUserId(null); setSelectedUser(null); }} />
          <div className="relative w-full max-w-sm bg-[#0F1724] border-l border-white/[0.08] overflow-y-auto animate-fadeIn">
            <div className="sticky top-0 bg-[#0F1724] border-b border-white/[0.08] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold text-white">{detail?.user?.fullName ?? selectedUser?.fullName ?? '—'}</p>
                <p className="text-[12px] text-white/40">{detail?.user?.team?.name ?? selectedUser?.teamName ?? ''}</p>
              </div>
              <button type="button" onClick={() => { setDetailUserId(null); setSelectedUser(null); }} className="p-1 rounded-lg hover:bg-white/[0.06]">
                <X size={16} className="text-white/40" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Balance */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-3 text-center">
                  <p className="text-[11px] text-white/30">Баланс</p>
                  <p className="text-lg font-bold text-white">{detail?.balance?.balanceHours ?? selectedUser?.balanceHours ?? 0} ч</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3 text-center">
                  <p className="text-[11px] text-white/30">Начислено</p>
                  <p className="text-lg font-bold text-emerald-400">{detail?.balance?.totalAddedHours ?? 0}</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3 text-center">
                  <p className="text-[11px] text-white/30">Использовано</p>
                  <p className="text-lg font-bold text-rose-400">{detail?.balance?.totalUsedHours ?? 0}</p>
                </div>
              </div>

              {/* Risk */}
              {selectedUser && (
                <div className={`rounded-xl ${riskBg[selectedUser.riskLevel]} p-3 flex items-center gap-3`}>
                  <TriangleAlert size={18} className={riskColors[selectedUser.riskLevel]} />
                  <div>
                    <p className={`text-[13px] font-bold ${riskColors[selectedUser.riskLevel]}`}>{riskLabels[selectedUser.riskLevel]}</p>
                    <p className="text-[12px] text-white/50">{selectedUser.totalHours} ч за период</p>
                  </div>
                </div>
              )}

              {/* Recent overtimes */}
              {(detail?.overtimes?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[12px] font-bold text-white/40 uppercase mb-2">Переработки</p>
                  <div className="space-y-1.5">
                    {detail?.overtimes?.slice(0, 10).map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                        <span className="text-[13px] text-white/60">{o.date.toISOString().slice(0, 10)}</span>
                        <span className="text-[13px] font-bold text-white">{o.hours} ч</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent timeoffs */}
              {(detail?.timeOffs?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[12px] font-bold text-white/40 uppercase mb-2">Отгулы</p>
                  <div className="space-y-1.5">
                    {detail?.timeOffs?.slice(0, 10).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                        <span className="text-[13px] text-white/60">{t.date.toISOString().slice(0, 10)}</span>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailQuery.isLoading && <Loader />}

              <EmptyState title="" description={detail?.overtimes?.length === 0 && detail?.timeOffs?.length === 0 ? 'Нет данных за период' : ''} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
