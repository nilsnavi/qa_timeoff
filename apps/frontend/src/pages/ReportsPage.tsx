import { BarChart3, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../shared/auth/AuthContext';
import { Card } from '../components/ui';
import { showAppToast } from '../shared/utils';
import { getAccessToken } from '../shared/api/client';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

const reportTypes = [
  { key: 'overtime', label: 'Переработки', icon: BarChart3 },
  { key: 'timeoff', label: 'Отгулы', icon: FileText },
  { key: 'vacation', label: 'Отпуска', icon: FileText },
];

export function ReportsPage() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const _isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const [teamId, _setTeamId] = useState('');

  const downloadCsv = async (type: string) => {
    const params = new URLSearchParams({ dateFrom, dateTo, unit: 'HOURS' });
    if (teamId) params.set('teamId', teamId);
    const token = getAccessToken();
    const url = type === 'overtime'
      ? `${API_URL}/analytics/workload/export/csv?${params}`
      : `${API_URL}/reports/export/csv?${params}&type=${type}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${type}_${dateFrom}_${dateTo}.csv`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch {
      showAppToast('Ошибка экспорта', undefined, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Отчёты</h1>
        <p className="text-[15px] text-white/40 mt-1">Экспорт данных по заявкам и нагрузке</p>
      </div>

      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="field-shell">
            <span className="field-label">С</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[14px] text-white outline-none" />
          </div>
          <div className="field-shell">
            <span className="field-label">По</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[14px] text-white outline-none" />
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((rt) => (
          <div key={rt.key} className="enterprise-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <rt.icon size={18} className="text-white/40" />
              <span className="text-[15px] font-semibold text-white/70">{rt.label}</span>
            </div>
            <button type="button" onClick={() => downloadCsv(rt.key)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/40 hover:text-white/70" title="Скачать CSV">
              <Download size={14} />
            </button>
          </div>
        ))}
      </div>

      {!user && (
        <div className="rounded-xl bg-white/[0.02] p-8 text-center">
          <p className="text-[14px] text-white/40">Войдите в систему для доступа к отчётам</p>
        </div>
      )}
    </div>
  );
}
