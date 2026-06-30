import { Edit3, Eye, Shield, Trash2 } from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import { Column, DataTable, SortDirection } from '../../components/dashboard-v2/DataTable';
import type { RoleDetail } from '../../shared/types';

type Props = {
  roles: RoleDetail[];
  loading?: boolean;
  sortKey: string | null;
  sortDir: SortDirection;
  onSort: (key: string) => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpen: (role: RoleDetail) => void;
  onDelete: (role: RoleDetail) => void;
};

export function RoleTable({ roles, loading, sortKey, sortDir, onSort, page, total, pageSize, onPageChange, onOpen, onDelete }: Props) {
  const columns: Column<RoleDetail>[] = [
    {
      key: 'name', header: 'Роль', width: '18%', sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Shield size={15} className={r.isSystem ? 'text-amber-400' : 'text-[#4C7DFF]'} />
          <span className="font-semibold text-white/90">{r.name}</span>
        </div>
      ),
    },
    { key: 'code', header: 'Код', width: '14%', sortable: true, render: (r) => <span className="text-white/40 font-mono text-[13px]">{r.code}</span> },
    {
      key: 'isSystem', header: 'Тип', width: '12%', sortable: true, render: (r) => (
        <Badge tone={r.isSystem ? 'warning' : 'info'}>{r.isSystem ? 'Системная' : 'Пользовательская'}</Badge>
      ),
    },
    { key: 'users', header: 'Пользователей', width: '11%', align: 'center', render: (r) => <span className="font-semibold text-white/80">{r._count?.users ?? 0}</span> },
    { key: 'perms', header: 'Разрешений', width: '11%', align: 'center', render: (r) => <span className="font-semibold text-white/80">{r.permissions?.length ?? 0}</span> },
    {
      key: 'isActive', header: 'Статус', width: '10%', sortable: true, align: 'center', render: (r) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase ${r.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-950/300/10 text-rose-400'}`}>
          {r.isActive ? 'Активна' : 'Отключена'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: '14%', align: 'right', render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpen(r); }} className="!min-h-0 h-7 w-7 !p-0 text-white/40 hover:text-white" title={r.isSystem ? 'Просмотр' : 'Настроить'}>
            {r.isSystem ? <Eye size={14} /> : <Edit3 size={14} />}
          </Button>
          {!r.isSystem && r._count?.users === 0 && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(r); }} className="!min-h-0 h-7 w-7 !p-0 text-rose-400" title="Удалить">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns as any}
      data={roles as any}
      keyField="id"
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      page={page}
      total={total}
      pageSize={pageSize}
      onPageChange={onPageChange}
      loading={loading}
      emptyMessage="Нет ролей"
      onRowClick={(row) => onOpen(row as unknown as RoleDetail)}
      rowClassName={() => 'cursor-pointer'}
    />
  );
}
