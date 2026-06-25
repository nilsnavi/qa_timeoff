import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, EmptyState, ErrorState, Field, Loader } from '../../components/ui';
import { api } from '../../shared/api';
import { clsx } from 'clsx';

export function AiForecastTab() {
  const [teamId, setTeamId] = useState('');
  const [monthsLookback, setMonthsLookback] = useState(3);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];

  const forecastQuery = useQuery({
    queryKey: ['admin', 'ai', 'forecast', teamId, monthsLookback],
    queryFn: () => api.aiForecast({ teamId: teamId || undefined, monthsLookback }),
  });

  const forecast = forecastQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="field-shell">
          <span className="field-label">Команда</span>
          <select value={teamId} onChange={e => setTeamId(e.target.value)} className="field-input">
            <option value="">Все команды</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <Field label="Месяцев анализа" type="number" value={String(monthsLookback)} onChange={e => setMonthsLookback(Number(e.target.value))} />
      </div>

      {forecastQuery.isLoading && <Loader />}
      {forecastQuery.isError && <ErrorState title="Ошибка загрузки прогноза" />}

      {forecast && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Уровень риска</span>
              <span className={clsx('text-lg font-bold', forecast.riskLevel === 'HIGH' ? 'text-rose-400' : forecast.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400')}>
                {forecast.riskLevel === 'HIGH' ? 'Высокий' : forecast.riskLevel === 'MEDIUM' ? 'Средний' : 'Низкий'}
              </span>
            </Card>
            <Card>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Прогноз овертайма</span>
              <span className="text-lg font-bold text-white">{forecast.predictedOvertimeHours} ч</span>
            </Card>
            <Card>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Сгенерирован</span>
              <span className="text-[14px] text-white/70">{new Date(forecast.generatedAt).toLocaleString('ru-RU')}</span>
            </Card>
          </div>

          {forecast.overloadedUsers.length > 0 && (
            <div>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-2 block">Перегруженные сотрудники</span>
              <div className="space-y-2">
                {forecast.overloadedUsers.map((u: any) => (
                  <Card key={u.userId}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[15px] font-semibold text-white">{u.fullName}</span>
                        <span className="text-[13px] text-white/30 ml-2">{u.teamName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={clsx('text-[13px] font-bold', u.riskLevel === 'HIGH' ? 'text-rose-400' : u.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400')}>
                          {u.riskLevel}
                        </span>
                        <span className="text-[13px] text-white/50">{u.currentOvertime} → {u.predictedOvertime} ч</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {forecast.recommendations.length > 0 && (
            <Card>
              <span className="block text-[13px] font-bold text-white/40 uppercase mb-2">Рекомендации</span>
              <ul className="space-y-1">
                {forecast.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-[14px] text-white/70 flex gap-2">
                    <span className="text-[#4C7DFF] shrink-0">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {!forecastQuery.isLoading && !forecastQuery.isError && !forecast && (
        <EmptyState title="Нет данных прогноза" description="Выберите параметры для загрузки" />
      )}
    </div>
  );
}
