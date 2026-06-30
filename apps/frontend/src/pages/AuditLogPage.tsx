import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Clock, Download, Eye, RefreshCw, Search, Shield, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, CustomSelect, EmptyState, ErrorState, Loader, Modal } from '../components/ui';
import type { SelectOption } from '../components/ui/CustomSelect';
import { DataTable, type Column, type SortDirection } from '../components/dashboard-v2/DataTable';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import type { AuditLogEntry } from '../shared/types';
import { clsx } from 'clsx';

const actionTypeOptions: SelectOption[] = [
  { value: '', label: 'Все действия' },
  { value: 'AUTH_LOGIN_SUCCESS', label: 'Вход в систему' },
  { value: 'AUTH_LOGOUT', label: 'Выход из системы' },
  { value: 'USER_CREATED', label: 'Создание пользователя' },
  { value: 'USER_UPDATED', label: 'Изменение пользователя' },
  { value: 'USER_ROLE_CHANGED', label: 'Смена роли' },
  { value: 'USER_DEACTIVATED', label: 'Деактивация' },
  { value: 'DISABLE_USER', label: 'Блокировка' },
  { value: 'CREATE_USER', label: 'Создание пользователя' },
  { value: 'UPDATE_USER_ROLE', label: 'Изменение роли' },
  { value: 'UPDATE_HOURLY_RATE', label: 'Изменение ставки' },
  { value: 'CANCEL_OVERTIME', label: 'Отмена переработки' },
  { value: 'ROLE_CREATED', label: 'Создание роли' },
  { value: 'ROLE_UPDATED', label: 'Изменение роли' },
  { value: 'ROLE_DELETED', label: 'Удаление роли' },
  { value: 'ROLE_CLONED', label: 'Копирование роли' },
  { value: 'ROLE_PERMISSION_UPDATED', label: 'Изменение прав' },
  { value: 'USER_ROLE_CHANGED', label: 'Назначение роли' },
  { value: 'TEAM_CREATED', label: 'Создание команды' },
  { value: 'TEAM_UPDATED', label: 'Изменение команды' },
  { value: 'TEAM_DELETED', label: 'Удаление команды' },
];

const sectionOptions: SelectOption[] = [
  { value: '', label: 'Все разделы' },
  { value: 'Auth', label: 'Авторизация' },
  { value: 'User', label: 'Пользователи' },
  { value: 'Team', label: 'Команды' },
  { value: 'Role', label: 'Роли' },
  { value: 'Balance', label: 'Баланс' },
  { value: 'TimeOff', label: 'Заявки' },
  { value: 'Vacation', label: 'Отпуска' },
  { value: 'Overtime', label: 'Переработки' },
  { value: 'CompanySettings', label: 'Настройки' },
];

const resultOptions: SelectOption[] = [
  { value: '', label: 'Все результаты' },
  { value: 'SUCCESS', label: 'Успешно' },
  { value: 'ERROR', label: 'Ошибка' },
  { value: 'FORBIDDEN', label: 'Отказано в доступе' },
];

const periodOptions: SelectOption[] = [
  { value: '', label: 'Всё время' },
  { value: 'today', label: 'Сегодня' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
];

const actionLabels: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: 'Вход в систему',
  AUTH_LOGOUT: 'Выход из системы',
  AUTH_LOGIN_FAILED: 'Ошибка входа',
  PASSWORD_CHANGED: 'Смена пароля',
  PASSWORD_RESET: 'Сброс пароля',
  USER_CREATED: 'Создание пользователя',
  USER_UPDATED: 'Изменение пользователя',
  USER_DEACTIVATED: 'Деактивация',
  USER_ACTIVATED: 'Активация',
  USER_ROLE_CHANGED: 'Смена роли',
  USER_TEAM_CHANGED: 'Смена команды',
  USER_PASSWORD_RESET: 'Сброс пароля',
  CREATE_USER: 'Создание пользователя',
  UPDATE_USER_ROLE: 'Изменение роли',
  DISABLE_USER: 'Блокировка',
  UPDATE_HOURLY_RATE: 'Изменение ставки',
  CANCEL_OVERTIME: 'Отмена переработки',
  TEAM_CREATED: 'Создание команды',
  TEAM_UPDATED: 'Изменение команды',
  TEAM_DELETED: 'Удаление команды',
  TEAM_LEAD_CHANGED: 'Смена руководителя',
  ROLE_CREATED: 'Создание роли',
  ROLE_UPDATED: 'Изменение роли',
  ROLE_DELETED: 'Удаление роли',
  ROLE_CLONED: 'Копирование роли',
  ROLE_PERMISSION_UPDATED: 'Изменение прав',
  ROLE_PERMISSION_CHANGED: 'Изменение прав роли',
  USER_ROLE_ASSIGNED: 'Назначение роли',
  REQUEST_CREATED: 'Создание заявки',
  REQUEST_UPDATED: 'Изменение заявки',
  REQUEST_SUBMITTED: 'Отправка на согласование',
  REQUEST_APPROVED: 'Согласование',
  REQUEST_REJECTED: 'Отклонение',
  REQUEST_CANCELLED: 'Отмена заявки',
  BALANCE_ACCRUED: 'Начисление часов',
  BALANCE_WRITTEN_OFF: 'Списание часов',
  BALANCE_ADJUSTED: 'Корректировка баланса',
  BALANCE_REFUNDED: 'Возврат часов',
  USERS_IMPORTED: 'Импорт пользователей',
  BALANCES_IMPORTED: 'Импорт балансов',
  REPORT_EXPORTED: 'Экспорт отчёта',
  AUDIT_LOG_EXPORTED: 'Экспорт журнала',
  COMPANY_SETTINGS_UPDATED: 'Изменение настроек',
  BALANCE_RULES_UPDATED: 'Изменение правил баланса',
  APPROVAL_POLICY_UPDATED: 'Изменение правил согласования',
  NOTIFICATION_SETTINGS_UPDATED: 'Изменение уведомлений',
};

function getDateRange(period: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { dateFrom: start.toISOString() };
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { dateFrom: start.toISOString() };
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { dateFrom: start.toISOString() };
    }
    default:
      return {};
  }
}

export function AuditLogPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [detailItem, setDetailItem] = useState<AuditLogEntry | null>(null);
  const pageSize = 20;

  const dateRange = getDateRange(period);

  const auditQuery = useQuery({
    queryKey: ['audit-log', { search, ...dateRange, action: actionFilter, entityType: sectionFilter, result: resultFilter, page }],
    queryFn: () => api.auditLogFull({
      search: search || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      action: actionFilter || undefined,
      entityType: sectionFilter || undefined,
      result: resultFilter || undefined,
      page,
      limit: pageSize,
    }),
    enabled: isAdmin,
  });

  const kpiQuery = useQuery({
    queryKey: ['audit-log', 'kpi', dateRange],
    queryFn: () => api.auditLogKpi(dateRange),
    enabled: isAdmin,
  });

  const data = auditQuery.data;
  const items = (data?.items as AuditLogEntry[]) ?? [];
  const total = data?.total ?? 0;

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return items;
    return [...items].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? '');
      const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? '');
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((p: SortDirection) => (p === 'asc' ? 'desc' : p === 'desc' ? null : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (dateRange.dateFrom) params.set('dateFrom', dateRange.dateFrom);
    if (dateRange.dateTo) params.set('dateTo', dateRange.dateTo);
    if (actionFilter) params.set('action', actionFilter);
    if (sectionFilter) params.set('entityType', sectionFilter);
    if (resultFilter) params.set('result', resultFilter);
    const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
    window.open(`${apiUrl}/audit-log/export/csv?${params.toString()}`);
  };

  if (!isAdmin) return <ErrorState title="У вас нет доступа к журналам" />;
  if (auditQuery.isError) return <ErrorState title="Не удалось загрузить журнал действий" onRetry={() => auditQuery.refetch()} />;

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'createdAt', header: 'Дата и время', width: '15%', sortable: true,
      render: (r: AuditLogEntry) => <span className="text-white/60 text-[13px]">{new Date(r.createdAt).toLocaleString('ru-RU')}</span>,
    },
    {
      key: 'actor', header: 'Пользователь', width: '14%',
      render: (r: AuditLogEntry) => <span className="font-semibold text-white/80">{r.actorName || r.actor?.fullName || '—'}</span>,
    },
    {
      key: 'actorRole', header: 'Роль', width: '8%',
      render: (r: AuditLogEntry) => <span className="text-white/40 text-[12px]">{r.actorRole || '—'}</span>,
    },
    {
      key: 'action', header: 'Действие', width: '16%',
      render: (r: AuditLogEntry) => <span className="text-[12px] font-bold text-white/50 uppercase">{actionLabels[r.action] || r.action}</span>,
    },
    {
      key: 'entityType', header: 'Раздел', width: '10%',
      render: (r: AuditLogEntry) => <span className="text-white/40 text-[12px]">{r.entityType}</span>,
    },
    {
      key: 'entityName', header: 'Объект', width: '12%',
      render: (r: AuditLogEntry) => <span className="text-white/60">{r.entityName || r.entityId?.slice(0, 8) || '—'}</span>,
    },
    {
      key: 'result', header: 'Результат', width: '9%', align: 'center',
      render: (r: AuditLogEntry) => (
        <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase',
          r.result === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
          r.result === 'ERROR' ? 'bg-rose-950/300/10 text-rose-400' :
          'bg-amber-500/10 text-amber-400')}>
          {r.result === 'SUCCESS' ? 'Успешно' : r.result === 'ERROR' ? 'Ошибка' : r.result || '—'}
        </span>
      ),
    },
    {
      key: 'ipAddress', header: 'IP', width: '10%',
      render: (r: AuditLogEntry) => <span className="text-white/30 text-[12px] font-mono">{r.ipAddress || '—'}</span>,
    },
    {
      key: 'actions', header: '', width: '6%', align: 'right',
      render: (r: AuditLogEntry) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailItem(r); }} className="!min-h-0 h-7 w-7 !p-0 text-white/40 hover:text-white">
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  const kpi = kpiQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Журналы</h1>
          <p className="text-[15px] text-white/40 mt-1">История действий пользователей и изменений в системе</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={14} className="mr-1" />Экспорт
          </Button>
          <button onClick={() => auditQuery.refetch()} className="grid h-9 w-9 place-items-center rounded-lg text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw size={16} className={auditQuery.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Всего событий" value={kpi?.total ?? 0} icon={Activity} color="blue" loading={kpiQuery.isLoading} />
        <KpiCard label="Сегодня" value={kpi?.todayCount ?? 0} icon={Clock} color="emerald" loading={kpiQuery.isLoading} />
        <KpiCard label="Ошибки" value={kpi?.errors ?? 0} icon={AlertTriangle} color="rose" loading={kpiQuery.isLoading} />
        <KpiCard label="Критичные действия" value={kpi?.criticalActions ?? 0} icon={Shield} color="amber" loading={kpiQuery.isLoading} />
        <KpiCard label="Активных пользователей" value={kpi?.activeUsers ?? 0} icon={Users} color="violet" loading={kpiQuery.isLoading} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Поиск по журналу..." className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-[15px] text-white placeholder:text-white/20 outline-none" />
        </div>
        <CustomSelect value={period} onChange={setPeriod} options={periodOptions} placeholder="Период" small className="w-32" />
        <CustomSelect value={actionFilter} onChange={(v: string) => { setActionFilter(v); setPage(1); }} options={actionTypeOptions} placeholder="Действие" small className="w-40" />
        <CustomSelect value={sectionFilter} onChange={(v: string) => { setSectionFilter(v); setPage(1); }} options={sectionOptions} placeholder="Раздел" small className="w-36" />
        <CustomSelect value={resultFilter} onChange={(v: string) => { setResultFilter(v); setPage(1); }} options={resultOptions} placeholder="Результат" small className="w-36" />
      </div>

      {auditQuery.isLoading && <Loader />}

      {!auditQuery.isLoading && items.length === 0 && (
        <EmptyState title="Записей журнала пока нет" description="События появятся здесь после действий пользователей в системе." />
      )}

      {!auditQuery.isLoading && items.length > 0 && (
        <DataTable
          columns={columns as any}
          data={sorted as any}
          keyField="id"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          emptyMessage="Нет записей"
        />
      )}

      {detailItem && (
        <AuditDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, loading }: { label: string; value: number; icon: React.ElementType; color: string; loading?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-400',
    amber: 'bg-amber-500/10 text-amber-400',
    violet: 'bg-violet-500/10 text-violet-400',
  };
  return (
    <div className="enterprise-card p-4 hover-lift">
      <div className="flex items-center gap-2 mb-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${colors[color]}`}><Icon size={14} /></div>
        <span className="text-[13px] font-semibold text-white/40">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">
        {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-white/[0.04]" /> : value}
      </span>
    </div>
  );
}

function AuditDetailModal({ item, onClose }: { item: AuditLogEntry; onClose: () => void }) {
  return (
    <Modal open title="Детали события" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Закрыть</Button>}>
      <div className="space-y-3">
        <DetailRow label="ID события" value={item.id} />
        <DetailRow label="Дата и время" value={new Date(item.createdAt).toLocaleString('ru-RU')} />
        <DetailRow label="Пользователь" value={item.actorName || item.actor?.fullName || '—'} />
        <DetailRow label="Роль пользователя" value={item.actorRole || '—'} />
        <DetailRow label="Тип действия" value={actionLabels[item.action] || item.action} />
        <DetailRow label="Раздел системы" value={item.entityType} />
        <DetailRow label="Объект" value={item.entityName || item.entityId || '—'} />
        {item.entityId && <DetailRow label="ID объекта" value={item.entityId} />}
        <DetailRow label="Результат" value={item.result || 'SUCCESS'} />
        <DetailRow label="IP-адрес" value={item.ipAddress || '—'} />
        {item.oldValue && <DetailRow label="Старое значение" value={JSON.stringify(item.oldValue, null, 2)} mono />}
        {item.newValue && <DetailRow label="Новое значение" value={JSON.stringify(item.newValue, null, 2)} mono />}
      </div>
    </Modal>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[13px] text-white/40 shrink-0 w-32">{label}</span>
      <span className={clsx('text-[14px] text-white/80', mono && 'font-mono text-[12px] bg-white/[0.03] rounded px-2 py-1')}>{value}</span>
    </div>
  );
}
