import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { Card, Button, Input } from '../components/ui';
import { useState } from 'react';
import { showAppToast } from '../shared/utils';

export function SettingsOrganizationPage() {
  const { user } = useAuth();
  const { data: settings, isLoading, refetch } = useQuery({ queryKey: ['company-settings'], queryFn: api.getCompanySettings });
  const [form, setForm] = useState<Record<string, string>>({});

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return <div className="rounded-xl bg-white/[0.03] p-6 text-center text-white/40">Нет доступа к настройкам</div>;
  }

  const handleSave = async () => {
    try {
      await api.updateCompanySettings(form);
      showAppToast('Настройки сохранены', undefined, 'success');
      refetch();
    } catch {
      showAppToast('Ошибка', 'Не удалось сохранить настройки', 'error');
    }
  };

  if (isLoading) return <div className="space-y-4"><SkeletonLine /><SkeletonLine /><SkeletonLine /></div>;

  const s = settings!;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Настройки организации</h1>
        <p className="text-[15px] text-white/40 mt-1">Управление настройками компании</p>
      </div>
      <Card>
        <div className="grid gap-4 max-w-lg">
          <Input label="Название компании" value={form.companyName ?? s.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} disabled={!isAdmin} />
          <Input label="Часовой пояс" value={form.timezone ?? s.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))} disabled={!isAdmin} />
          <Input label="Рабочих часов в день" type="number" value={form.workingHoursPerDay ?? String(s.workingHoursPerDay)} onChange={e => setForm(p => ({ ...p, workingHoursPerDay: e.target.value }))} disabled={!isAdmin} />
          <Input label="Рабочих дней в неделю" type="number" value={form.workWeekDays ?? String(s.workWeekDays)} onChange={e => setForm(p => ({ ...p, workWeekDays: e.target.value }))} disabled={!isAdmin} />
          <Input label="Годовая норма часов" type="number" value={form.defaultAnnualHours ?? String(s.defaultAnnualHours)} onChange={e => setForm(p => ({ ...p, defaultAnnualHours: e.target.value }))} disabled={!isAdmin} />
          <Input label="Мин. покрытие команды (%)" type="number" value={form.minimumTeamCoveragePercent ?? String(s.minimumTeamCoveragePercent)} onChange={e => setForm(p => ({ ...p, minimumTeamCoveragePercent: e.target.value }))} disabled={!isAdmin} />
          {isAdmin && <Button onClick={handleSave}>Сохранить</Button>}
        </div>
      </Card>
    </div>
  );
}

function SkeletonLine() {
  return <div className="h-10 rounded-lg bg-white/[0.04]" />;
}
