import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Grid3X3, History, Plus, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, ErrorState, Header } from '../components/ui';
import { api } from '../shared/api';
import { SortDirection } from '../components/dashboard-v2/DataTable';
import type { RoleDetail } from '../shared/types';
import { CreateRoleModal } from './roles/CreateRoleModal';
import { PermissionsMatrix } from './roles/PermissionsMatrix';
import { RoleCard } from './roles/RoleCard';
import { RoleEditDrawer } from './roles/RoleEditDrawer';
import { RoleKpiCards } from './roles/RoleKpiCards';
import { RoleTable } from './roles/RoleTable';

type TabView = 'cards' | 'table';

export function SettingsRolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [view, setView] = useState<TabView>('table');
  const [sortKey, setSortKey] = useState<string | null>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const kpiQuery = useQuery({ queryKey: ['roles', 'kpi'], queryFn: api.roleKpi });
  const rolesQuery = useQuery({
    queryKey: ['roles', { search, isSystem: typeFilter !== 'ALL' ? typeFilter === 'SYSTEM' : undefined, isActive: activeFilter !== 'ALL' ? activeFilter === 'ACTIVE' : undefined }],
    queryFn: () => api.roles({
      search: search || undefined,
      isSystem: typeFilter !== 'ALL' ? typeFilter === 'SYSTEM' : undefined,
      isActive: activeFilter !== 'ALL' ? activeFilter === 'ACTIVE' : undefined,
    }),
  });

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const isLoading = rolesQuery.isLoading;
  const isError = rolesQuery.isError;

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return roles;
    return [...roles].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? '');
      const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? '');
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [roles, sortKey, sortDir]);

  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(p => (p === 'asc' ? 'desc' : p === 'desc' ? null : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const [deleteTarget, setDeleteTarget] = useState<RoleDetail | null>(null);

  if (isError) return <ErrorState title="Ошибка загрузки" description="Не удалось загрузить роли" onRetry={() => rolesQuery.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Header
          title="Управление ролями"
          subtitle="Настройка прав доступа пользователей и команд"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>
            <History size={14} className="mr-1" />История изменений
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMatrixOpen(true)}>
            <Grid3X3 size={14} className="mr-1" />Матрица прав
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" />Создать роль
          </Button>
        </div>
      </div>

      <RoleKpiCards kpi={kpiQuery.data} loading={kpiQuery.isLoading} />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Поиск по ролям..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-[15px] text-white placeholder:text-white/20 outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1">
          {(['ALL', 'SYSTEM', 'CUSTOM'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setTypeFilter(v); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${typeFilter === v ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50'}`}
            >
              {v === 'ALL' ? 'Все роли' : v === 'SYSTEM' ? 'Системные' : 'Пользовательские'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setActiveFilter(v); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${activeFilter === v ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50'}`}
            >
              {v === 'ALL' ? 'Все' : v === 'ACTIVE' ? 'Активные' : 'Отключенные'}
            </button>
          ))}
        </div>

        <button onClick={() => rolesQuery.refetch()} className="grid h-9 w-9 place-items-center rounded-lg text-white/30 hover:text-white/60 transition-colors">
          <RefreshCw size={16} className={rolesQuery.isFetching ? 'animate-spin' : ''} />
        </button>

        <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 ml-auto">
          <button
            onClick={() => setView('table')}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${view === 'table' ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50'}`}
          >
            Таблица
          </button>
          <button
            onClick={() => setView('cards')}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${view === 'cards' ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50'}`}
          >
            Карточки
          </button>
        </div>
      </div>

      {view === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map(role => (
            <RoleCard key={role.id} role={role} onOpen={r => setEditRoleId(r.id)} />
          ))}
          {!isLoading && roles.length === 0 && (
            <div className="col-span-full enterprise-card p-10 text-center">
              <p className="text-[15px] text-white/30">Роли не найдены</p>
            </div>
          )}
        </div>
      )}

      {view === 'table' && (
        <RoleTable
          roles={paginated as any}
          loading={isLoading}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          page={page}
          total={sorted.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onOpen={r => setEditRoleId(r.id)}
          onDelete={r => setDeleteTarget(r)}
        />
      )}

      {createOpen && (
        <CreateRoleModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            queryClient.invalidateQueries({ queryKey: ['roles', 'kpi'] });
          }}
        />
      )}

      {(editRoleId || deleteTarget) && (
        <RoleEditDrawer
          roleId={editRoleId || deleteTarget?.id || null}
          onClose={() => { setEditRoleId(null); setDeleteTarget(null); }}
        />
      )}

      <PermissionsMatrix open={matrixOpen} onClose={() => setMatrixOpen(false)} />

      {historyOpen && (
        <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auditQuery = useQuery({
    queryKey: ['admin', 'audit', 'Role', 0],
    queryFn: () => api.auditLogs({ entityType: 'Role', limit: 100, offset: 0 }),
    enabled: open,
  });

  const items = auditQuery.data?.items ?? [];

  const actionLabels: Record<string, string> = {
    ROLE_CREATED: 'Роль создана',
    ROLE_UPDATED: 'Роль изменена',
    ROLE_DELETED: 'Роль удалена',
    ROLE_CLONED: 'Роль склонирована',
    ROLE_PERMISSION_UPDATED: 'Права изменены',
    USER_ROLE_CHANGED: 'Пользователь назначен',
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-8 overflow-auto">
        <div className="w-full max-w-3xl enterprise-card p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-white">История изменений ролей</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
          </div>
          {auditQuery.isLoading && <p className="text-[14px] text-white/30 py-8 text-center">Загрузка...</p>}
          {items.length === 0 && !auditQuery.isLoading && <p className="text-[14px] text-white/30 py-8 text-center">Нет записей</p>}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="enterprise-card p-3 flex items-center gap-3">
                <span className="text-[12px] text-white/30 shrink-0 w-32">{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
                <span className="text-[13px] font-semibold text-white/70 shrink-0 w-28 truncate">{item.actor?.fullName || 'Система'}</span>
                <span className="text-[12px] font-bold text-white/40 uppercase shrink-0">{actionLabels[item.action] || item.action}</span>
                {item.payload && <span className="text-[12px] text-white/30 truncate">{item.entityId?.slice(0, 8)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    </>
  );
}
