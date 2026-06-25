import { useQuery } from '@tanstack/react-query';
import { BarChart3, Clock, TrendingUp, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Field, Loader } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { WorkloadReport } from '../shared/types';
import { Navigate } from 'react-router-dom';

const BAR_COLOR = '#4C7DFF';

function Bar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <span className="w-28 shrink-0 text-right text-[13px] text-white/60 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: BAR_COLOR }} />
      </div>
      <span className="w-12 text-right text-[13px] font-semibold text-white/80">{value}</span>
    </div>
  );
}

function clsx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function AnalyticsPage() {
  const { dashboard } = useDashboard();
  const canView = ['ADMIN', 'MANAGER'].includes(dashboard.user.role);
  const now = new Date();
  const startOfMonth = now.toISOString().slice(0, 7) + '-01';
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [teamId, setTeamId] = useState('');
  const [applied, setApplied] = useState({ startDate, endDate, teamId });

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];

  const reportQuery = useQuery({
    queryKey: ['admin', 'analytics', 'workload', applied.startDate, applied.endDate, applied.teamId],
    queryFn: () => api.workloadReport({ startDate: applied.startDate, endDate: applied.endDate, teamId: applied.teamId || undefined }),
    enabled: !!applied.startDate && !!applied.endDate,
  });

  const report: WorkloadReport | undefined = reportQuery.data;

  const maxUserHours = useMemo(
    () => Math.max(...(report?.workloadByUser ?? []).map(u => u.totalHours), 1),
    [report?.workloadByUser],
  );

  const maxDayHours = useMemo(
    () => Math.max(...(report?.workloadByDay ?? []).map(d => d.hours), 1),
    [report?.workloadByDay],
  );

  const peakDay = useMemo(() => {
    if (!report?.workloadByDay?.length) return null;
    return [...report.workloadByDay].sort((a, b) => b.hours - a.hours)[0];
  }, [report?.workloadByDay]);

  if (!canView) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Аналитика нагрузки</h1>
          <p className="text-[15px] text-white/40 mt-1">Отчёт по переработкам и загрузке сотрудников</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="От" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Field label="До" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className="field-input">
              <option value="">Все команды</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Button onClick={() => setApplied({ startDate, endDate, teamId })}>
            Применить
          </Button>
        </div>
      </Card>

      {reportQuery.isLoading && <Loader />}
      {reportQuery.isError && <ErrorState title="Ошибка загрузки" />}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-amber-400" />
                <span className="text-[12px] font-bold text-white/30 uppercase">Всего переработок</span>
              </div>
              <span className="text-2xl font-bold text-white">{report.overtimeTrend?.reduce((s, m) => s + m.hours, 0) ?? 0} ч</span>
            </Card>
            {report.topOverloaded?.[0] && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} className="text-rose-400" />
                  <span className="text-[12px] font-bold text-white/30 uppercase">Топ-1 сотрудник</span>
                </div>
                <span className="text-lg font-bold text-rose-400">{report.topOverloaded[0].fullName}</span>
                <span className="text-[13px] text-white/50 ml-2">{report.topOverloaded[0].totalHours} ч</span>
              </Card>
            )}
            {peakDay && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-[#4C7DFF]" />
                  <span className="text-[12px] font-bold text-white/30 uppercase">Пик нагрузки</span>
                </div>
                <span className="text-lg font-bold text-white">{peakDay.date}</span>
                <span className="text-[13px] text-white/50 ml-2">{peakDay.hours} ч</span>
              </Card>
            )}
          </div>

          {/* Workload by day bar chart */}
          {report.workloadByDay && report.workloadByDay.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Нагрузка по дням</span>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {report.workloadByDay.map(d => (
                  <Bar key={d.date} value={d.hours} max={maxDayHours} label={d.date} />
                ))}
              </div>
            </Card>
          )}

          {/* Workload by user horizontal bar */}
          {report.workloadByUser && report.workloadByUser.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Нагрузка по сотрудникам (топ-10)</span>
              <div className="space-y-1">
                {report.workloadByUser.slice(0, 10).map(u => (
                  <Bar key={u.userId} value={u.totalHours} max={maxUserHours} label={u.fullName} />
                ))}
              </div>
            </Card>
          )}

          {/* Overtime trend */}
          {report.overtimeTrend && report.overtimeTrend.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Тренд переработок по месяцам</span>
              <div className="space-y-1">
                {report.overtimeTrend.map(m => (
                  <Bar key={m.month} value={m.hours} max={Math.max(...report.overtimeTrend.map(x => x.hours), 1)} label={m.month} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {!reportQuery.isLoading && !reportQuery.isError && !report && (
        <EmptyState title="Нет данных" description="Выберите период и нажмите «Применить»" />
      )}
    </div>
  );
}
