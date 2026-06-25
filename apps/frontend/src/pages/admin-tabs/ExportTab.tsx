import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field } from '../../components/ui';
import { api } from '../../shared/api';

export function ExportTab() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [kpiMonth, setKpiMonth] = useState(now.getMonth() + 1);
  const [kpiYear, setKpiYear] = useState(now.getFullYear());

  const openUrl = (url: string) => window.open(url, '_blank');

  return (
    <div className="space-y-4">
      <Card>
        <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Овертайм и зарплата</span>
        <div className="flex items-end gap-3 mb-4">
          <Field label="От" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Field label="До" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openUrl(api.exportOvertimeCsv({ startDate, endDate }))}>
            <Download size={14} className="mr-1" />Овертайм CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openUrl(api.exportPayrollCsv({ startDate, endDate }))}>
            <Download size={14} className="mr-1" />Payroll CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openUrl(api.export1cOvertimeCsv({ startDate, endDate }))}>
            <Download size={14} className="mr-1" />1С Овертайм CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openUrl(api.export1cPayrollCsv({ startDate, endDate }))}>
            <Download size={14} className="mr-1" />1С Payroll CSV
          </Button>
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
        <Button size="sm" variant="secondary" onClick={() => openUrl(api.exportKpiCsv({ month: kpiMonth, year: kpiYear }))}>
          <Download size={14} className="mr-1" />KPI CSV
        </Button>
      </Card>
    </div>
  );
}
