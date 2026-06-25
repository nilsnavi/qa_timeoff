import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CustomSelect, EmptyState, ErrorState, Field, Loader } from '../../components/ui';
import type { SelectOption } from '../../components/ui/CustomSelect';
import { api } from '../../shared/api';
import { clsx } from 'clsx';

const RISK_LABELS: Record<string, string> = { LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий' };
const RISK_TONES: Record<string, 'success' | 'warning' | 'danger'> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };

export function AiForecastTab() {
  const [teamId, setTeamId] = useState('');
  const [monthsLookback, setMonthsLookback] = useState(3);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];

  const teamOptions: SelectOption[] = [
    { value: '', label: 'Все команды' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  const forecastQuery = useQuery({
    queryKey: ['admin', 'ai', 'forecast', teamId, monthsLookback],
    queryFn: () => api.aiForecast({ teamId: teamId || undefined, monthsLookback }),
  });

  const forecast = forecastQuery.data;

  const sortedUsers = useMemo(
    () => (forecast?.overloadedUsers ?? []).filter(u => u.predictedOvertime > 0).sort((a, b) => b.predictedOvertime - a.predictedOvertime),
    [forecast?.overloadedUsers],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <CustomSelect
              value={teamId}
              onChange={setTeamId}
              options={teamOptions}
              placeholder="Все команды"
            />
          </div>
          <Field label="Месяцев анализа" type="number" value={String(monthsLookback)} onChange={e => setMonthsLookback(Number(e.target.value))} />
        </div>
        <Button size="sm" variant="secondary" onClick={() => forecastQuery.refetch()} disabled={forecastQuery.isFetching}>
          <RefreshCw size={14} className={clsx('mr-1', forecastQuery.isFetching && 'animate-spin')} />
          Обновить
        </Button>
      </div>

      {forecastQuery.isLoading && <Loader />}
      {forecastQuery.isError && <ErrorState title="Ошибка загрузки прогноза" />}

      {forecast && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Уровень риска</span>
              <Badge tone={RISK_TONES[forecast.riskLevel]}>{RISK_LABELS[forecast.riskLevel]}</Badge>
            </Card>
            <Card>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Прогноз овертайма</span>
              <span className="text-2xl font-bold text-white">{forecast.predictedOvertimeHours} ч</span>
            </Card>
            <Card>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Сгенерирован</span>
              <span className="text-[14px] text-white/70">{new Date(forecast.generatedAt).toLocaleString('ru-RU')}</span>
            </Card>
          </div>

          {sortedUsers.length > 0 && (
            <div>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-2 block">
                Сотрудники с риском ({sortedUsers.length})
              </span>
              <div className="space-y-2">
                {sortedUsers.map(u => (
                  <Card key={u.userId}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[15px] font-semibold text-white">{u.fullName}</span>
                        <span className="text-[13px] text-white/30 ml-2">{u.teamName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone={RISK_TONES[u.riskLevel]}>{RISK_LABELS[u.riskLevel]}</Badge>
                        <span className="text-[13px] text-white/50">{u.currentOvertime} → <strong className="text-white/80">{u.predictedOvertime}</strong> ч</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {forecast.recommendations.length > 0 && (
            <div>
              <span className="text-[13px] font-bold text-white/40 uppercase mb-2 block">Рекомендации</span>
              <div className="space-y-2">
                {forecast.recommendations.map((rec, i) => (
                  <Card key={i}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                      <span className="text-[14px] text-white/70">{rec}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!forecastQuery.isLoading && !forecastQuery.isError && !forecast && (
        <EmptyState title="Нет данных прогноза" description="Выберите параметры и нажмите «Обновить»" />
      )}
    </div>
  );
}
