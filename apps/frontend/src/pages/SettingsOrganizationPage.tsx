import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Calendar, CheckCircle, Clock, Globe, History, Link2, Save, Upload, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button, CustomSelect, ErrorState, Loader, Modal } from '../components/ui';
import type { SelectOption } from '../components/ui/CustomSelect';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { showAppToast } from '../shared/utils';
import { clsx } from 'clsx';

const CRITICAL_KEYS = ['workingHoursPerDay', 'workWeekDays', 'defaultAnnualHours', 'allowNegativeBalance', 'minimumTeamCoveragePercent', 'approvalPolicy'];

const timezoneOptions: SelectOption[] = [
  { value: 'Europe/Moscow', label: 'Europe/Moscow (GMT+3)' },
  { value: 'Europe/Kaliningrad', label: 'Europe/Kaliningrad (GMT+2)' },
  { value: 'Europe/Samara', label: 'Europe/Samara (GMT+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Asia/Yekaterinburg (GMT+5)' },
  { value: 'Asia/Omsk', label: 'Asia/Omsk (GMT+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Asia/Krasnoyarsk (GMT+7)' },
  { value: 'Asia/Irkutsk', label: 'Asia/Irkutsk (GMT+8)' },
  { value: 'Asia/Yakutsk', label: 'Asia/Yakutsk (GMT+9)' },
  { value: 'Asia/Vladivostok', label: 'Asia/Vladivostok (GMT+10)' },
  { value: 'Asia/Kamchatka', label: 'Asia/Kamchatka (GMT+12)' },
  { value: 'UTC', label: 'UTC' },
];

const approvalPolicyOptions: SelectOption[] = [
  { value: 'MANAGER_OR_ADMIN', label: 'Руководитель или ADMIN' },
  { value: 'LEAD_THEN_MANAGER', label: 'LEAD → MANAGER' },
  { value: 'MANAGER_THEN_ADMIN', label: 'MANAGER → ADMIN' },
  { value: 'ADMIN_ONLY', label: 'Только ADMIN' },
];

type Tab = 'main' | 'schedule' | 'balance' | 'approval' | 'coverage' | 'notifications' | 'integrations' | 'history';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'main', label: 'Основное', icon: Globe },
  { key: 'schedule', label: 'Рабочий график', icon: Calendar },
  { key: 'balance', label: 'Баланс', icon: Clock },
  { key: 'approval', label: 'Согласование', icon: CheckCircle },
  { key: 'coverage', label: 'Покрытие', icon: Users },
  { key: 'notifications', label: 'Уведомления', icon: Bell },
  { key: 'integrations', label: 'Интеграции', icon: Link2 },
  { key: 'history', label: 'История', icon: History },
];

export function SettingsOrganizationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<Tab>('main');
  const [form, setForm] = useState<Record<string, any>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<Record<string, any> | null>(null);

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['company-settings'], queryFn: api.getCompanySettings,
  });

  const auditQuery = useQuery({
    queryKey: ['company-settings-audit'], queryFn: api.getCompanySettingsAudit, enabled: activeTab === 'history',
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.updateCompanySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      showAppToast('Настройки сохранены');
      setForm({});
    },
    onError: () => showAppToast('Ошибка', 'Не удалось сохранить'),
  });

  const handleSave = (data: Record<string, any>) => {
    const hasCritical = Object.keys(data).some(k => CRITICAL_KEYS.includes(k));
    if (hasCritical) { setPendingSave(data); setConfirmOpen(true); }
    else { saveMutation.mutate(data); }
  };

  if (isLoading) return <Loader />;
  if (isError) return <ErrorState title="Не удалось загрузить настройки организации" onRetry={() => refetch()} />;
  if (!settings) return <ErrorState title="Настройки организации ещё не заданы" description="Создайте настройки по умолчанию" />;

  const s = settings;

  const f = (key: string): any => form[key] ?? (s as any)[key];
  const set = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Настройки организации</h1>
          <p className="text-[15px] text-white/40 mt-1">Управление правилами компании</p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(form).length > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setForm({})}><X size={14} className="mr-1" />Отменить</Button>
              <Button size="sm" onClick={() => handleSave(form)} disabled={saveMutation.isPending}><Save size={14} className="mr-1" />Сохранить</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 w-fit flex-wrap">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={clsx('flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors', activeTab === tab.key ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50')}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>

      <div className="enterprise-card p-6 space-y-4 max-w-2xl">
        {activeTab === 'main' && (
          <>
            <InputRow label="Название организации" value={f('companyName')} onChange={e => set('companyName', e.target.value)} disabled={!isAdmin} />
            <SelectRow label="Часовой пояс" value={f('timezone')} onChange={v => set('timezone', v)} options={timezoneOptions} disabled={!isAdmin} />
            <SelectRow label="Язык интерфейса" value={f('locale')} onChange={v => set('locale', v)} options={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]} disabled={!isAdmin} />
            <SelectRow label="Формат даты" value={f('dateFormat')} onChange={v => set('dateFormat', v)} options={[{ value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]} disabled={!isAdmin} />
            <InputRow label="Рабочих часов в день" value={f('workingHoursPerDay')} onChange={e => set('workingHoursPerDay', Number(e.target.value))} type="number" disabled={!isAdmin} hint="Используется для перевода дней в часы" />
            <InputRow label="Рабочих дней в неделю" value={f('workingDaysPerWeek')} onChange={e => set('workingDaysPerWeek', Number(e.target.value))} type="number" disabled={!isAdmin} />
            <InputRow label="Годовая норма часов" value={f('defaultAnnualHours')} onChange={e => set('defaultAnnualHours', Number(e.target.value))} type="number" disabled={!isAdmin} hint="workingDaysPerYear × workingHoursPerDay" />
          </>
        )}

        {activeTab === 'schedule' && (
          <>
            <InputRow label="Рабочих часов в день" value={f('workingHoursPerDay')} onChange={e => set('workingHoursPerDay', Number(e.target.value))} type="number" min={1} max={24} disabled={!isAdmin} />
            <SelectRow label="Рабочих дней в неделю" value={f('workWeekDays')} onChange={v => set('workWeekDays', Number(v))} options={[1,2,3,4,5,6,7].map(n => ({ value: String(n), label: `${n}` }))} disabled={!isAdmin} />
            <InputRow label="Рабочих дней в неделю" value={f('workingDaysPerWeek')} onChange={e => set('workingDaysPerWeek', Number(e.target.value))} type="number" min={1} max={7} disabled={!isAdmin} />
            <InputRow label="Годовая норма часов" value={f('defaultAnnualHours')} onChange={e => set('defaultAnnualHours', Number(e.target.value))} type="number" disabled={!isAdmin} hint="Минимум 0 часов" />
            <div className="pt-4 mt-4 border-t border-white/[0.06]">
              <h3 className="text-[15px] font-bold text-white/60 mb-2">Индивидуальные графики</h3>
              <p className="text-[13px] text-white/30 mb-3">
                Настройки выше применяются ко всем сотрудникам по умолчанию.
                Для сменных графиков (2/2, 3/3, ночные смены) загрузите индивидуальные
                графики через массовый импорт.
              </p>
              {isAdmin && <Button variant="secondary" size="sm" onClick={() => navigate('/import?type=SCHEDULES')}><Upload size={14} className="mr-1" />Импортировать графики</Button>}
            </div>
          </>
        )}

        {activeTab === 'balance' && (
          <>
            <InputRow label="Годовая норма часов" value={f('defaultAnnualHours')} onChange={e => set('defaultAnnualHours', Number(e.target.value))} type="number" disabled={!isAdmin} />
            <ToggleRow label="Разрешить отрицательный баланс" checked={!!f('allowNegativeBalance')} onChange={v => set('allowNegativeBalance', v)} disabled={!isAdmin} hint="Если выключено, баланс не может уходить ниже 0" />
            <InputRow label="Минимальный остаток баланса" value={f('minimumBalanceHours')} onChange={e => set('minimumBalanceHours', Number(e.target.value))} type="number" min={0} disabled={!isAdmin} />
          </>
        )}

        {activeTab === 'approval' && (
          <>
            <SelectRow label="Политика согласования" value={f('approvalPolicy')} onChange={v => set('approvalPolicy', v)} options={approvalPolicyOptions} disabled={!isAdmin} />
            <ToggleRow label="Требовать комментарий при отклонении" checked={!!f('requireRejectComment')} onChange={v => set('requireRejectComment', v)} disabled={!isAdmin} />
            <ToggleRow label="Проверять покрытие команды" checked={!!f('blockApprovalOnCoverageRisk')} onChange={v => set('blockApprovalOnCoverageRisk', v)} disabled={!isAdmin} hint="Блокировать согласование при нехватке сотрудников" />
          </>
        )}

        {activeTab === 'coverage' && (
          <>
            <InputRow label="Мин. покрытие команды (%)" value={f('minimumTeamCoveragePercent')} onChange={e => set('minimumTeamCoveragePercent', Number(e.target.value))} type="number" min={0} max={100} disabled={!isAdmin} />
            <ToggleRow label="Блокировать заявку при нехватке сотрудников" checked={!!f('blockApprovalOnCoverageRisk')} onChange={v => set('blockApprovalOnCoverageRisk', v)} disabled={!isAdmin} />
            <ToggleRow label="Учитывать pending-заявки как риск" checked={!!f('countPendingAsCoverageRisk')} onChange={v => set('countPendingAsCoverageRisk', v)} disabled={!isAdmin} hint="Показывать предупреждение при риске" />
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            <ToggleRow label="In-app уведомления" checked={!!f('inAppNotificationsEnabled')} onChange={v => set('inAppNotificationsEnabled', v)} disabled={!isAdmin} />
            <ToggleRow label="Email уведомления" checked={!!f('emailNotificationsEnabled')} onChange={v => set('emailNotificationsEnabled', v)} disabled={!isAdmin} />
            <ToggleRow label="Telegram уведомления" checked={!!f('telegramNotificationsEnabled')} onChange={v => set('telegramNotificationsEnabled', v)} disabled={!isAdmin} />
            <div className="pt-2 border-t border-white/[0.06]" />
            <ToggleRow label="О новой заявке" checked={!!f('notifyNewRequest')} onChange={v => set('notifyNewRequest', v)} disabled={!isAdmin} />
            <ToggleRow label="О согласовании" checked={!!f('notifyApproval')} onChange={v => set('notifyApproval', v)} disabled={!isAdmin} />
            <ToggleRow label="Об отклонении" checked={!!f('notifyRejection')} onChange={v => set('notifyRejection', v)} disabled={!isAdmin} />
            <ToggleRow label="О низком балансе" checked={!!f('notifyLowBalance')} onChange={v => set('notifyLowBalance', v)} disabled={!isAdmin} />
            <ToggleRow label="О риске покрытия команды" checked={!!f('notifyCoverageRisk')} onChange={v => set('notifyCoverageRisk', v)} disabled={!isAdmin} />
            <ToggleRow label="О просроченных заявках" checked={!!f('notifyOverdueRequests')} onChange={v => set('notifyOverdueRequests', v)} disabled={!isAdmin} />
          </>
        )}

        {activeTab === 'integrations' && (
          <>
            <h3 className="text-[15px] font-bold text-white/60">Email (SMTP)</h3>
            <InputRow label="SMTP Host" value={f('smtpHost')} onChange={e => set('smtpHost', e.target.value)} disabled={!isAdmin} placeholder="smtp.mail.ru" />
            <InputRow label="SMTP Port" value={f('smtpPort')} onChange={e => set('smtpPort', Number(e.target.value))} type="number" disabled={!isAdmin} placeholder="465" />
            <InputRow label="SMTP User" value={f('smtpUser')} onChange={e => set('smtpUser', e.target.value)} disabled={!isAdmin} />
            <InputRow label="SMTP From" value={f('smtpFrom')} onChange={e => set('smtpFrom', e.target.value)} disabled={!isAdmin} placeholder="noreply@company.ru" />
            <InputRow label="SMTP Password" value={f('smtpPassword')} onChange={e => set('smtpPassword', e.target.value)} disabled={!isAdmin} type="password" placeholder="Пароль (скрыт после сохранения)" />
            <h3 className="text-[15px] font-bold text-white/60 pt-4">Telegram</h3>
            <ToggleRow label="Telegram бот включён" checked={!!f('telegramBotEnabled')} onChange={v => set('telegramBotEnabled', v)} disabled={!isAdmin} />
            <InputRow label="Bot Token" value={f('telegramBotToken')} onChange={e => set('telegramBotToken', e.target.value)} disabled={!isAdmin} placeholder="Токен (скрыт после сохранения)" />
          </>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            <span className="text-[13px] font-bold text-white/40 uppercase">Последние изменения</span>
            {s.updatedBy && <div className="text-[13px] text-white/30 mb-2">Последнее изменение: {s.updatedBy.fullName}, {new Date(s.updatedAt).toLocaleString('ru-RU')}</div>}
            {auditQuery.isLoading && <Loader />}
            {auditQuery.data?.length === 0 && <div className="text-[14px] text-white/30 py-4">Нет записей об изменениях</div>}
            {auditQuery.data?.map((item: any) => (
              <div key={item.id} className="enterprise-card p-3 flex items-center gap-3">
                <span className="text-[12px] text-white/30 shrink-0 w-32">{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
                <span className="text-[13px] text-white/60">{item.actor?.fullName || '—'}</span>
                <span className="text-[12px] text-white/30 truncate">{item.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmOpen && (
        <Modal open title="Критичное изменение" onClose={() => { setConfirmOpen(false); setPendingSave(null); }}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setConfirmOpen(false); setPendingSave(null); }}>Отмена</Button>
              <Button onClick={() => { saveMutation.mutate(pendingSave!); setConfirmOpen(false); setPendingSave(null); }}>Продолжить</Button>
            </div>
          }>
          <p className="text-[14px] text-white/60">Изменение этих настроек может повлиять на расчёт баланса, календаря и согласование заявок. Продолжить?</p>
        </Modal>
      )}
    </div>
  );
}

function InputRow({ label, value, type, onChange, disabled, placeholder, min, max, hint }: { label: string; value: any; type?: string; onChange?: (e: any) => void; disabled?: boolean; placeholder?: string; min?: number; max?: number; hint?: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[13px] text-white/40">{label}</span>
      <input type={type || 'text'} value={value ?? ''} onChange={onChange} disabled={disabled} placeholder={placeholder} min={min} max={max}
        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[15px] text-white placeholder:text-white/20 outline-none disabled:opacity-50" />
      {hint && <p className="text-[12px] text-white/20">{hint}</p>}
    </div>
  );
}

function SelectRow({ label, value, onChange, options, disabled }: { label: string; value: any; onChange?: (v: string) => void; options: SelectOption[]; disabled?: boolean }) {
  if (disabled) return <InputRow label={label} value={options.find(o => o.value === String(value ?? ''))?.label ?? value} disabled />;
  return (
    <div className="space-y-1">
      <span className="text-[13px] text-white/40">{label}</span>
      <CustomSelect value={String(value ?? '')} onChange={v => onChange?.(v)} options={options} placeholder="" className="w-full" />
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange?.(e.target.checked)} disabled={disabled} className="h-4 w-4 rounded accent-[#4C7DFF]" />
        <span className="text-[14px] text-white/70">{label}</span>
      </label>
      {hint && <p className="text-[12px] text-white/20 ml-7">{hint}</p>}
    </div>
  );
}
