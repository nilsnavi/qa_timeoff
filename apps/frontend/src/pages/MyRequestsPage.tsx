import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, Clock, Eye, Filter, Plus, Search, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button, EmptyState, Loader } from '../components/ui';
import { DataTable, type Column, type SortDirection } from '../components/dashboard-v2/DataTable';
import { CreateTeamRequestModal } from '../components/team-requests/CreateTeamRequestModal';
import { ViewRequestModal } from '../components/team-requests/ViewRequestModal';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { LeaveRequest } from '../shared/types';

const STATUS_TABS = [
  { key: '', label: 'Все' },
  { key: 'PENDING', label: 'Ожидают' },
  { key: 'APPROVED', label: 'Согласованы' },
  { key: 'REJECTED', label: 'Отклонены' },
  { key: 'ACTIVE', label: 'Активны' },
  { key: 'DRAFT', label: 'Черновики' },
  { key: 'EXPIRED', label: 'Истекли' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  TIME_OFF: 'Отгул', VACATION: 'Отпуск', OVERTIME: 'Сверхурочные',
  OVERWORK: 'Переработка', REMOTE_WORK: 'Удалённая работа', OTHER: 'Прочее',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-white/10 text-white/40', PENDING: 'bg-amber-500/10 text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400', REJECTED: 'bg-rose-500/10 text-rose-400',
  CANCELLED: 'bg-white/5 text-white/30', ACTIVE: 'bg-blue-500/10 text-blue-400',
  EXPIRED: 'bg-orange-500/10 text-orange-400',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик', PENDING: 'На согласовании', APPROVED: 'Одобрено',
  REJECTED: 'Отклонено', CANCELLED: 'Отменено', ACTIVE: 'Активно', EXPIRED: 'Истекло',
};

export function MyRequestsPage() {
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const currentUser = dashboard.user;

  const [activeTab, setActiveTab] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<LeaveRequest | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const requestsQuery = useQuery({
    queryKey: ['team-requests', 'my', { status: activeTab, page, type: typeFilter }],
    queryFn: () => api.teamRequests({
      employeeId: currentUser.id,
      status: activeTab || undefined,
      page,
      limit: 25,
      type: typeFilter || undefined,
    }),
    staleTime: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['team-requests'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  };

  const data = requestsQuery.data;

  const sortedItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!sortKey || !sortDir) return items;
    return [...items].sort((a, b) => {
      const cmp = String((a as any)[sortKey] ?? '').localeCompare(String((b as any)[sortKey] ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data?.items, sortKey, sortDir]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return sortedItems;
    const q = searchQuery.toLowerCase();
    return sortedItems.filter(r =>
      r.reason?.toLowerCase().includes(q) ||
      TYPE_LABELS[r.type]?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    );
  }, [sortedItems, searchQuery]);

  const statusCounts = useMemo(() => {
    const allItems = data?.items ?? [];
    const counts: Record<string, number> = {};
    for (const r of allItems) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    counts[''] = allItems.length;
    return counts;
  }, [data?.items]);

  const columns: Column<LeaveRequest>[] = [
    { key: 'id', header: 'ID', width: '110px', sortable: true,
      render: (r) => <span className="text-[13px] font-mono text-white/40">#{r.id.slice(0, 8)}</span> },
    { key: 'type', header: 'Тип', width: '140px', sortable: true,
      render: (r) => <span className="text-[13px] text-white/70">{TYPE_LABELS[r.type] ?? r.type}</span> },
    { key: 'dateFrom', header: 'Период', width: '180px', sortable: true,
      render: (r) => (
        <span className="text-[13px] text-white/60">
          {new Date(r.dateFrom).toLocaleDateString('ru-RU')}
          {r.dateTo ? ` — ${new Date(r.dateTo).toLocaleDateString('ru-RU')}` : ''}
        </span>
      ) },
    { key: 'hours', header: 'Часы', width: '70px',
      render: (r) => <span className="text-[14px] font-bold text-white">{r.hours}ч</span> },
    { key: 'status', header: 'Статус', width: '130px', sortable: true,
      render: (r) => (
        <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS_CLASSES[r.status])}>
          {r.status === 'PENDING' && <Clock size={10} className="mr-1" />}
          {STATUS_LABELS[r.status]}
        </span>
      ) },
    { key: 'reason', header: 'Причина', render: (r) => (
      <span className="text-[13px] text-white/50 line-clamp-1">{r.reason || r.comment || '—'}</span>
    ) },
    { key: 'createdAt', header: 'Создана', width: '110px', sortable: true,
      render: (r) => <span className="text-[13px] text-white/35">{new Date(r.createdAt).toLocaleDateString('ru-RU')}</span> },
    { key: 'actions', header: '', width: '50px', align: 'center',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setViewTarget(r); }}
          title="Просмотр"
          className="grid h-7 w-7 place-items-center rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06]"
        >
          <Eye size={14} />
        </button>
      ) },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-white/30 mb-1">
            <span>Заявки</span>
            <ChevronDown size={12} className="rotate-[-90deg]" />
            <span className="text-white/70">Мои заявки</span>
          </div>
          <h1 className="text-[24px] font-bold text-white">Мои заявки</h1>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} className="mr-1" /> Создать заявку
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters(f => !f)}
          className={clsx('flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
            showFilters ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]')}
        >
          <Filter size={14} /> Фильтры
        </button>
        {showFilters && (
          <>
            <div className="h-6 w-px bg-white/[0.06]" />
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 text-[13px] text-white/70 outline-none focus:border-[#4C7DFF]/40"
            >
              <option value="">Все типы</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {typeFilter && (
              <button onClick={() => { setTypeFilter(''); setPage(1); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-white/30 hover:text-rose-400 transition-colors">
                <X size={12} /> Сбросить
              </button>
            )}
          </>
        )}
        <div className="flex-1" />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск..." className="h-9 w-48 rounded-lg bg-white/[0.04] border border-white/[0.06] pl-10 pr-3 text-[13px] text-white/70 placeholder:text-white/20 outline-none focus:border-[#4C7DFF]/40"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={clsx('flex items-center gap-1.5 shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors',
              activeTab === tab.key ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]')}
          >
            {tab.label}
            <span className={clsx('rounded-full px-1.5 py-0.5 text-[11px] leading-none',
              activeTab === tab.key ? 'bg-[#4C7DFF]/20 text-[#4C7DFF]' : 'bg-white/[0.04] text-white/25')}>
              {statusCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {requestsQuery.isLoading ? (
        <Loader label="Загружаем заявки..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Заявок нет"
          description="Создайте первую заявку — она появится здесь."
          action={<Button size="sm" onClick={() => setShowCreateModal(true)}><Plus size={14} className="mr-1" /> Создать заявку</Button>}
        />
      ) : (
        <DataTable
          columns={columns as any[]}
          data={filteredItems as any}
          keyField="id"
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          page={page} total={data?.total ?? 0} pageSize={25} onPageChange={setPage}
          emptyMessage={searchQuery ? 'Ничего не найдено' : 'Нет заявок'}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTeamRequestModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); invalidateAll(); }}
        />
      )}
      {viewTarget && (
        <ViewRequestModal
          request={viewTarget}
          onClose={() => setViewTarget(null)}
          onSuccess={() => { setViewTarget(null); invalidateAll(); }}
        />
      )}
    </div>
  );
}
