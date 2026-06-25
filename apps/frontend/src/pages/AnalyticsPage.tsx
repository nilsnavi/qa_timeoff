import { useQuery } from '@tanstack/react-query';
import { Clock, TrendingUp, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  BarChart, Bar as ReBar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { Button, Card, EmptyState, ErrorState, Field, Loader } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { WorkloadReport } from '../shared/types';
import { Navigate } from 'react-router-dom';

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

  const peakDay = useMemo(() => {
    if (!report?.workloadByDay?.length) return null;
    return [...report.workloadByDay].sort((a, b) => b.hours - a.hours)[0];
  }, [report?.workloadByDay]);

  if (!canView) return <Navigate to="/" replace />;

  const tooltipTheme = {
    contentStyle: { background: '#111A2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
    labelStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
    itemStyle: { color: '#4C7DFF', fontSize: 12 },
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Аналитика нагрузки</h1>
          <p className="text-[15px] text-white/40 mt-1">Отчёт по переработкам и загрузке сотрудников</p>
        </div>
      </div>

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

          {report.workloadByDay && report.workloadByDay.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Нагрузка по дням</span>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={report.workloadByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
                    tickFormatter={(v: string) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip {...tooltipTheme} />
                  <ReBar dataKey="hours" fill="#4C7DFF" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {report.workloadByUser && report.workloadByUser.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Нагрузка по сотрудникам (топ-10)</span>
              <ResponsiveContainer width="100%" height={Math.max(report.workloadByUser.slice(0, 10).length * 32, 120)}>
                <BarChart
                  layout="vertical"
                  data={report.workloadByUser.slice(0, 10)}
                  margin={{ top: 4, right: 40, left: 4, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis
                    type="category"
                    dataKey="fullName"
                    width={110}
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
                  />
                  <Tooltip {...tooltipTheme} />
                  <ReBar dataKey="totalHours" fill="#4C7DFF" radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {report.overtimeTrend && report.overtimeTrend.length > 0 && (
            <Card>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Тренд переработок по месяцам</span>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={report.overtimeTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip
                    contentStyle={{ background: '#111A2E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    itemStyle={{ color: '#7C5CFF', fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#7C5CFF"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#7C5CFF' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
