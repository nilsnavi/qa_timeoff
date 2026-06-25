import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CustomSelect, EmptyState, ErrorState, Field, Loader } from '../../components/ui';
import type { SelectOption } from '../../components/ui/CustomSelect';
import { api } from '../../shared/api';
import type { WorkloadReport } from '../../shared/types';

export function AnalyticsTab() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [teamId, setTeamId] = useState('');

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];

  const teamOptions: SelectOption[] = [
    { value: '', label: 'Все команды' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  const reportQuery = useQuery({
    queryKey: ['admin', 'analytics', 'workload', startDate, endDate, teamId],
    queryFn: () => api.workloadReport({ startDate, endDate, teamId: teamId || undefined }),
    enabled: !!startDate && !!endDate,
  });

  const report: WorkloadReport | undefined = reportQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Field label="От" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <Field label="До" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <div className="field-shell">
          <span className="field-label">Команда</span>
          <CustomSelect
            value={teamId}
            onChange={setTeamId}
            options={teamOptions}
            placeholder="Все команды"
          />
        </div>
      </div>

      {reportQuery.isLoading && <Loader />}
      {reportQuery.isError && <ErrorState title="Ошибка загрузки отчёта" />}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.topOverloaded?.slice(0, 4).map((u: any) => (
              <Card key={u.userId}>
                <span className="block text-[12px] font-bold text-white/30 uppercase">{u.fullName}</span>
                <span className="text-lg font-bold text-rose-400">{u.totalHours} ч</span>
              </Card>
            ))}
          </div>

          {report.workloadByTeam && report.workloadByTeam.length > 0 && (
            <div>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-2 block">Нагрузка по командам</span>
              <div className="space-y-2">
                {report.workloadByTeam.map((t: any) => (
                  <Card key={t.teamName}>
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] text-white">{t.teamName}</span>
                      <span className="text-[15px] font-semibold text-white/70">{t.totalHours} ч</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {report.workloadByUser && report.workloadByUser.length > 0 && (
            <div>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-2 block">Нагрузка по сотрудникам</span>
              <div className="space-y-2">
                {report.workloadByUser.slice(0, 20).map((u: any) => (
                  <Card key={u.userId}>
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] text-white">{u.fullName}</span>
                      <span className="text-[15px] font-semibold text-white/70">{u.totalHours} ч</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!reportQuery.isLoading && !reportQuery.isError && !report && (
        <EmptyState title="Выберите период" description="Укажите даты для загрузки отчёта" />
      )}
    </div>
  );
}
