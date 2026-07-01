import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, Bell, Check, ChevronDown, Clock, Download, ExternalLink, Eye,
  Filter, Plus, RefreshCcw, Search, Users, X
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Button, EmptyState, Loader } from '../../components/ui';
import { DataTable, type Column, type SortDirection } from '../../components/dashboard-v2/DataTable';
import { CreateTeamRequestModal } from '../../components/team-requests/CreateTeamRequestModal';
import { ReprocessRequestModal } from '../../components/team-requests/ReprocessRequestModal';
import { ViewRequestModal } from '../../components/team-requests/ViewRequestModal';
import { useTheme } from '../../shared/theme/ThemeContext';
import { api } from '../../shared/api';
import { showAppToast } from '../../shared/utils';
import type { LeaveRequest } from '../../shared/types';

const STATUS_TABS = [
  { key: '', label: 'Все' },
  { key: 'PENDING', label: 'На согласовании', color: 'text-amber-400' },
  { key: 'APPROVED', label: 'Одобрены', color: 'text-emerald-400' },
  { key: 'ACTIVE', label: 'Активны', color: 'text-blue-400' },
  { key: 'REJECTED', label: 'Отклонены', color: 'text-rose-400' },
  { key: 'DRAFT', label: 'Черновики', color: 'text-white/40' },
  { key: 'EXPIRED', label: 'Истекли', color: 'text-orange-400' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  TIME_OFF: 'Отгул',
  VACATION: 'Отпуск',
  OVERTIME: 'Сверхурочные',
  OVERWORK: 'Переработка',
  REMOTE_WORK: 'Удалённая работа',
  OTHER: 'Прочее',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-white/10 text-white/40',
  PENDING: 'bg-amber-500/10 text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400',
  REJECTED: 'bg-rose-500/10 text-rose-400',
  CANCELLED: 'bg-white/5 text-white/30',
  ACTIVE: 'bg-blue-500/10 text-blue-400',
  EXPIRED: 'bg-orange-500/10 text-orange-400',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  PENDING: 'На согласовании',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
  CANCELLED: 'Отменено',
  ACTIVE: 'Активно',
  EXPIRED: 'Истекло',
};

const DONUT_COLORS = ['#4C7DFF', '#7C5CFF', '#A78BFA', '#E879F9', '#FB923C', '#34D399'];

export function TeamRequestsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const tooltipStyle = useMemo(() => ({
    background: isDark ? '#0F1829' : '#FFFFFF',
    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    fontSize: 12,
  }), [isDark]);

  const [activeTab, setActiveTab] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reprocessTarget, setReprocessTarget] = useState<LeaveRequest | null>(null);
  const [viewTarget, setViewTarget] = useState<LeaveRequest | null>(null);
  const [selectedTeamId, _setSelectedTeamId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: api.users,
    staleTime: 5 * 60_000,
  });

  const requestsQuery = useQuery({
    queryKey: ['team-requests', { status: activeTab, page, teamId: selectedTeamId, type: typeFilter, employeeId: employeeFilter }],
    queryFn: () => api.teamRequests({ status: activeTab || undefined, page, limit: 25, teamId: selectedTeamId || undefined, type: typeFilter || undefined, employeeId: employeeFilter || undefined }),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['team-requests', 'stats', selectedTeamId],
    queryFn: () => api.teamRequestsStats(selectedTeamId || undefined),
    staleTime: 60_000,
  });

  const loadQuery = useQuery({
    queryKey: ['team-requests', 'load', selectedTeamId],
    queryFn: () => api.teamRequestsLoad(selectedTeamId || undefined),
    staleTime: 60_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['team-requests'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveTeamRequest(id),
    onSuccess: () => { showAppToast('Заявка одобрена'); invalidateAll(); },
    onError: () => showAppToast('Ошибка при одобрении', undefined, 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => api.rejectTeamRequest(id, comment),
    onSuccess: () => { showAppToast('Заявка отклонена'); invalidateAll(); },
    onError: () => showAppToast('Ошибка при отклонении', undefined, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTeamRequest(id),
    onSuccess: () => { showAppToast('Заявка удалена'); invalidateAll(); },
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const data = requestsQuery.data;

  const sortedItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!sortKey || !sortDir) return items;
    return [...items].sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? '';
      const bVal = (b as any)[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data?.items, sortKey, sortDir]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return sortedItems;
    const q = searchQuery.toLowerCase();
    return sortedItems.filter(r =>
      r.user?.fullName?.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      TYPE_LABELS[r.type]?.toLowerCase().includes(q)
    );
  }, [sortedItems, searchQuery]);

  const donutData = useMemo(() => {
    return (statsQuery.data?.byType ?? []).map((t, i) => ({
      name: TYPE_LABELS[t.type] ?? t.type,
      value: t.count,
      fill: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
  }, [statsQuery.data]);

  const sc = statsQuery.data?.statusCounts;

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'id',
      header: 'ID заявки',
      width: '140px',
      sortable: true,
      render: (row) => (
        <span className="text-[13px] font-mono text-white/50">#{row.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'user',
      header: 'Сотрудник',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-[#4C7DFF]/20 flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#4C7DFF]">
              {(row.user?.fullName ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-white/90 truncate">{row.user?.fullName ?? '—'}</p>
            <p className="text-[12px] text-white/35">{row.user?.position ?? row.user?.email ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Тип заявки',
      width: '150px',
      sortable: true,
      render: (row) => (
        <span className="text-[13px] text-white/70">{TYPE_LABELS[row.type] ?? row.type}</span>
      ),
    },
    {
      key: 'dateFrom',
      header: 'Период',
      width: '180px',
      sortable: true,
      render: (row) => (
        <span className="text-[13px] text-white/60">
          {new Date(row.dateFrom).toLocaleDateString('ru-RU')}
          {row.dateTo ? ` — ${new Date(row.dateTo).toLocaleDateString('ru-RU')}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '140px',
      sortable: true,
      render: (row) => (
        <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS_COLORS[row.status])}>
          {row.status === 'PENDING' && <Clock size={10} className="mr-1" />}
          {row.status === 'APPROVED' && <Check size={10} className="mr-1" />}
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      key: 'slaDueDate',
      header: 'SLA',
      width: '80px',
      render: (row) => {
        if (!row.slaDueDate || row.status !== 'PENDING') return <span className="text-[12px] text-white/15">—</span>;
        const now = new Date();
        const sla = new Date(row.slaDueDate);
        const diffHours = (sla.getTime() - now.getTime()) / 3600000;
        const overdue = diffHours < 0;
        const warning = diffHours >= 0 && diffHours < 48;
        return (
          <span className={clsx(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
            overdue ? 'bg-rose-500/15 text-rose-400' : warning ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400',
          )}>
            {overdue ? 'Просрочен' : warning ? 'Скоро' : 'В норме'}
          </span>
        );
      },
    },
    {
      key: 'approver',
      header: 'Согласующие',
      width: '120px',
      render: (row) => (
        row.approver ? (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-white/50">
                {(row.approver.fullName ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <span className="text-[12px] text-white/50">{row.approver.fullName}</span>
          </div>
        ) : (
          <span className="text-[12px] text-white/25">—</span>
        )
      ),
    },
    {
      key: 'createdAt',
      header: 'Создана',
      width: '110px',
      sortable: true,
      render: (row) => (
        <span className="text-[13px] text-white/40">
          {new Date(row.createdAt).toLocaleDateString('ru-RU')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Действия',
      width: '130px',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setViewTarget(row); }}
            title="Просмотр"
            className="grid h-7 w-7 place-items-center rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06]"
          >
            <Eye size={14} />
          </button>
          {row.status === 'PENDING' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); approveMutation.mutate(row.id); }}
                title="Одобрить"
                className="grid h-7 w-7 place-items-center rounded text-emerald-400/40 hover:text-emerald-400 hover:bg-emerald-500/10"
              >
                <Check size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); rejectMutation.mutate({ id: row.id, comment: '' }); }}
                title="Отклонить"
                className="grid h-7 w-7 place-items-center rounded text-rose-400/40 hover:text-rose-400 hover:bg-rose-500/10"
              >
                <X size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  api.remindTeamRequest(row.id).then(() => {
                    showAppToast('Напоминание отправлено руководителям');
                  }).catch(() => showAppToast('Ошибка отправки напоминания', undefined, 'error'));
                }}
                title="Напомнить"
                className="grid h-7 w-7 place-items-center rounded text-amber-400/40 hover:text-amber-400 hover:bg-amber-500/10"
              >
                <Bell size={13} />
              </button>
            </>
          )}
          {(row.status === 'APPROVED' || row.status === 'ACTIVE') && (
            <button
              onClick={(e) => { e.stopPropagation(); setReprocessTarget(row); }}
              title="Переработка"
              className="grid h-7 w-7 place-items-center rounded text-orange-400/40 hover:text-orange-400 hover:bg-orange-500/10"
            >
              <RefreshCcw size={13} />
            </button>
          )}
          {row.status === 'DRAFT' && (
            <button
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(row.id); }}
              title="Удалить"
              className="grid h-7 w-7 place-items-center rounded text-rose-400/30 hover:text-rose-400 hover:bg-rose-500/10"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-white/30 mb-1">
            <span>Заявки</span>
            <ChevronDown size={12} className="rotate-[-90deg]" />
            <span className="text-white/70">Заявки команды</span>
          </div>
          <h1 className="text-[24px] font-bold text-white">Заявки команды</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="h-10 w-56 rounded-xl bg-white/[0.04] border border-white/[0.06] pl-10 pr-3 text-[14px] text-white/80 placeholder:text-white/20 outline-none focus:border-[#4C7DFF]/40"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/timetracking/calendar')}>
            <Download size={14} className="mr-1" /> Экспорт
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-1" /> Создать заявку
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters(f => !f)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
            showFilters ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
          )}
        >
          <Filter size={14} />
          Фильтры
        </button>
        {showFilters && (
          <>
            <div className="h-6 w-px bg-white/[0.06]" />
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 text-[13px] text-white/70 outline-none focus:border-[#4C7DFF]/40 cursor-pointer"
            >
              <option value="">Все типы</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="h-6 w-px bg-white/[0.06]" />
            <select
              value={employeeFilter}
              onChange={e => { setEmployeeFilter(e.target.value); setPage(1); }}
              className="h-9 max-w-[220px] rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 text-[13px] text-white/70 outline-none focus:border-[#4C7DFF]/40 cursor-pointer"
            >
              <option value="">Все сотрудники</option>
              {allUsers?.map(u => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
            {(typeFilter || employeeFilter) && (
              <button
                onClick={() => { setTypeFilter(''); setEmployeeFilter(''); setPage(1); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-white/30 hover:text-rose-400 transition-colors"
              >
                <X size={12} /> Сбросить
              </button>
            )}
          </>
        )}
      </div>

      {/* KPI Row */}
      {sc && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Всего', value: sc.total, color: 'text-white' },
            { label: 'На согласовании', value: sc.pending, color: 'text-amber-400' },
            { label: 'Одобрено', value: sc.approved, color: 'text-emerald-400' },
            { label: 'Отклонено', value: sc.rejected, color: 'text-rose-400' },
          ].map(kpi => (
            <div key={kpi.label} className="enterprise-card p-4">
              <p className="text-[12px] font-medium text-white/35">{kpi.label}</p>
              <p className={clsx('text-[28px] font-bold leading-none mt-1', kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab filters */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => {
          const count = tab.key
            ? (sc as any)?.[tab.key.toLowerCase()] ?? 0
            : sc?.total ?? 0;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={clsx(
                'flex items-center gap-1.5 shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors',
                activeTab === tab.key
                  ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
              )}
            >
              {tab.label}
              <span className={clsx('rounded-full px-1.5 py-0.5 text-[11px] leading-none',
                activeTab === tab.key ? 'bg-[#4C7DFF]/20 text-[#4C7DFF]' : 'bg-white/[0.04] text-white/25')}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main content: Table + Sidebar */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          {requestsQuery.isLoading ? (
            <Loader label="Загружаем заявки..." />
          ) : filteredItems.length === 0 && !searchQuery ? (
            <EmptyState
              title="Заявок нет"
              description="Новые заявки команды появятся здесь."
              action={<Button size="sm" onClick={() => setShowCreateModal(true)}><Plus size={14} className="mr-1" /> Создать заявку</Button>}
            />
          ) : (
            <DataTable
              columns={columns as any[]}
              data={filteredItems as any}
              keyField="id"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              page={page}
              total={filteredItems.length < 25 ? filteredItems.length : (data?.total ?? 0)}
              pageSize={25}
              onPageChange={setPage}
              emptyMessage={searchQuery ? 'Ничего не найдено' : 'Нет заявок'}
              onRowClick={() => {}}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Analytics chart */}
          <div className="enterprise-card p-5">
            <h3 className="text-[14px] font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={15} className="text-[#4C7DFF]" />
              Статистика по типам
            </h3>
            {donutData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-[140px] h-[140px] shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                        {donutData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">
                  {donutData.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                        <span className="text-[12px] text-white/60">{d.name}</span>
                      </div>
                      <span className="text-[13px] font-semibold text-white/80">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-white/25 text-center py-6">Нет данных</p>
            )}
          </div>

          {/* Status breakdown */}
          {sc && (
            <div className="enterprise-card p-5">
              <h3 className="text-[14px] font-bold text-white mb-3">Сводка по статусам</h3>
              <div className="space-y-2">
                {[
                  { label: 'Всего', value: sc.total },
                  { label: 'На согласовании', value: sc.pending },
                  { label: 'Одобрено', value: sc.approved },
                  { label: 'Отклонено', value: sc.rejected },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[13px] text-white/45">{item.label}</span>
                    <span className="text-[14px] font-semibold text-white">{item.value}</span>
                  </div>
                ))}
                {(statsQuery.data?.expiring ?? 0) > 0 && (
                  <div className="flex items-center gap-2 mt-2 rounded-lg bg-orange-500/10 px-3 py-2">
                    <Clock size={13} className="text-orange-400 shrink-0" />
                    <span className="text-[12px] text-orange-400">
                      Истекают скоро: <b>{statsQuery.data?.expiring ?? 0}</b>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team load */}
          {loadQuery.data && (
            <div className="enterprise-card p-5">
              <h3 className="text-[14px] font-bold text-white mb-3 flex items-center gap-2">
                <Users size={15} className="text-[#4C7DFF]" />
                Нагрузка команды
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-white/40">Загруженность</span>
                    <span className="text-[13px] font-bold text-[#4C7DFF]">{loadQuery.data.loadPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#4C7DFF] to-[#7C5CFF] transition-all"
                      style={{ width: `${Math.min(loadQuery.data.loadPercent, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/40">{loadQuery.data.totalLoadHours}ч занято</span>
                  <span className="text-white/30">из {loadQuery.data.maxCapacity}ч</span>
                </div>
                {loadQuery.data.byUser.slice(0, 5).map(u => (
                  <div key={u.userId} className="flex items-center justify-between">
                    <span className="text-[12px] text-white/50 truncate max-w-[200px]">{u.fullName}</span>
                    <span className="text-[12px] font-semibold text-white/70">{u.hours}ч</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="enterprise-card p-5">
            <h3 className="text-[14px] font-bold text-white mb-3">Быстрые действия</h3>
            <div className="space-y-2">
              <button onClick={() => setShowCreateModal(true)}
                className="flex w-full items-center gap-2.5 rounded-lg bg-[#4C7DFF]/10 px-3 py-2.5 text-[13px] font-semibold text-[#4C7DFF] hover:bg-[#4C7DFF]/20 transition-colors">
                <Plus size={14} /> Создать заявку
              </button>
              <button
                onClick={() => {
                  api.approveAllTeamRequests().then(r => {
                    showAppToast(`Одобрено заявок: ${r.approved}`);
                    invalidateAll();
                  }).catch(() => showAppToast('Ошибка', undefined, 'error'));
                }}
                className="flex w-full items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[13px] font-medium text-white/50 hover:bg-white/[0.08] transition-colors">
                <Check size={14} /> Утвердить все
              </button>
              <button
                onClick={() => navigate('/timetracking/calendar')}
                className="flex w-full items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[13px] font-medium text-white/50 hover:bg-white/[0.08] transition-colors">
                <ExternalLink size={14} /> Календарь
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTeamRequestModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); invalidateAll(); }}
        />
      )}

      {/* View modal */}
      {viewTarget && (
        <ViewRequestModal
          request={viewTarget}
          onClose={() => setViewTarget(null)}
          onSuccess={() => { setViewTarget(null); invalidateAll(); }}
        />
      )}

      {/* Reprocess modal */}
      {reprocessTarget && (
        <ReprocessRequestModal
          request={reprocessTarget}
          onClose={() => setReprocessTarget(null)}
          onSuccess={() => setReprocessTarget(null)}
        />
      )}
    </div>
  );
}
