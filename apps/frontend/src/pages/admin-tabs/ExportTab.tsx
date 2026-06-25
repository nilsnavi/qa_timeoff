import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field } from '../../components/ui';
import { downloadCsv } from '../../shared/utils/download';
import { showAppToast } from '../../shared/utils';
import { api } from '../../shared/api';
import { useQuery } from '@tanstack/react-query';

export function ExportTab() {
  const now = new Date();
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportTeam, setExportTeam] = useState('');
  const [kpiMonth, setKpiMonth] = useState(now.getMonth() + 1);
  const [kpiYear, setKpiYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState<string | null>(null);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const teams = teamsQuery.data ?? [];

  const handleExport = async (type: string) => {
    setDownloading(type);
    try {
      const params = new URLSearchParams();
      if (exportFrom) params.set('startDate', exportFrom);
      if (exportTo) params.set('endDate', exportTo);
      if (exportTeam && exportTeam !== 'ALL') params.set('teamId', exportTeam);
      const qs = params.toString() ? `?${params}` : '';

      const map: Record<string, [string, string]> = {
        overtime:     [`/admin/export/overtime.csv${qs}`,  'overtime.csv'],
        payroll:      [`/admin/export/payroll.csv${qs}`,   'payroll.csv'],
        kpi:          [`/admin/export/kpi.csv?month=${kpiMonth}&year=${kpiYear}`, 'kpi.csv'],
        '1c-overtime': [`/admin/export/1c/overtime.csv${qs}`, '1c_overtime.csv'],
        '1c-payroll':  [`/admin/export/1c/payroll.csv${qs}`,  '1c_payroll.csv'],
      };
      const [path, filename] = map[type];
      await downloadCsv(path, filename);
      showAppToast('Файл скачан');
    } catch {
      showAppToast('Ошибка экспорта', undefined, 'error');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Фильтры</span>
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Период с" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
          <Field label="Период по" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} />
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <select value={exportTeam} onChange={e => setExportTeam(e.target.value)} className="field-input">
              <option value="ALL">Все команды</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Стандартные отчёты</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            ['overtime', 'Переработки CSV'],
            ['payroll', 'Зарплатная ведомость CSV'],
          ] as const).map(([key, label]) => (
            <Button key={key} size="sm" variant="secondary" onClick={() => handleExport(key)} disabled={downloading !== null}>
              {downloading === key ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />}
              {label}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">KPI</span>
        <div className="flex items-end gap-3 mb-4">
          <div className="field-shell">
            <span className="field-label">Месяц</span>
            <select value={kpiMonth} onChange={e => setKpiMonth(Number(e.target.value))} className="field-input">
              {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'].map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
            </select>
          </div>
          <Field label="Год" type="number" value={String(kpiYear)} onChange={e => setKpiYear(Number(e.target.value))} />
        </div>
        <Button size="sm" variant="secondary" onClick={() => handleExport('kpi')} disabled={downloading !== null}>
          {downloading === 'kpi' ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />}
          KPI CSV
        </Button>
      </Card>

      <Card>
        <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">1С: Предприятие</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            ['1c-overtime', '1С: Переработки'],
            ['1c-payroll', '1С: Ведомость'],
          ] as const).map(([key, label]) => (
            <Button key={key} size="sm" variant="secondary" onClick={() => handleExport(key)} disabled={downloading !== null}>
              {downloading === key ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />}
              {label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
