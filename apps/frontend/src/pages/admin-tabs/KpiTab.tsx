import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Loader } from '../../components/ui';
import { api } from '../../shared/api';
import type { KpiPeriod } from '../../shared/types';

const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function KpiTab() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const kpiQuery = useQuery({
    queryKey: ['admin', 'kpi', month, year],
    queryFn: () => api.kpiList({ month, year }),
  });

  const recalcMutation = useMutation({
    mutationFn: api.recalculateKpi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'kpi'] }),
  });

  const data = kpiQuery.data;
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/60 outline-none">
            {monthNames.slice(1).map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/60 outline-none">
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <Button size="sm" variant="secondary" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending}>
          <RefreshCw size={14} className={clsx('mr-1', recalcMutation.isPending && 'animate-spin')} />
          Пересчитать KPI
        </Button>
      </div>

      {kpiQuery.isLoading && <Loader />}
      {kpiQuery.isError && <ErrorState title="Ошибка загрузки KPI" />}

      {!kpiQuery.isLoading && !kpiQuery.isError && items.length === 0 && (
        <EmptyState title="Нет данных KPI" description="Нажмите «Пересчитать KPI» чтобы сгенерировать показатели" />
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((kpi: KpiPeriod) => (
            <Card key={kpi.id}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[15px] font-semibold text-white">{kpi.user?.fullName ?? '—'}</span>
                  {kpi.user?.position && <span className="text-[13px] text-white/30 ml-2">{kpi.user.position}</span>}
                </div>
                <span className={clsx('text-lg font-bold', kpi.kpiScore >= 80 ? 'text-emerald-400' : kpi.kpiScore >= 50 ? 'text-amber-400' : 'text-rose-400')}>
                  {kpi.kpiScore.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiStat label="План" value={`${kpi.plannedHours} ч`} />
                <KpiStat label="Факт" value={`${kpi.actualWorkedHours} ч`} />
                <KpiStat label="Овертайм" value={`${kpi.overtimeHours} ч`} />
                <KpiStat label="Нагрузка" value={`${(kpi.workloadScore ?? 0).toFixed(0)}%`} />
                <KpiStat label="Надёжность" value={`${(kpi.reliabilityScore ?? 0).toFixed(0)}%`} />
                <KpiStat label="Заявки" value={`${kpi.approvedRequests}✅ / ${kpi.rejectedRequests}❌ / ${kpi.cancelledRequests}↩️`} />
                <KpiStat label="Ср. время ответа" value={`${(kpi.responseTimeAvgHours ?? 0).toFixed(1)} ч`} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[12px] font-bold text-white/30 uppercase">{label}</span>
      <span className="text-[14px] text-white/70">{value}</span>
    </div>
  );
}
