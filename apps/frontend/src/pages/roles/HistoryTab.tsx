import { useQuery } from '@tanstack/react-query';
import { EmptyState, Loader } from '../../components/ui';
import { api } from '../../shared/api';
import type { RoleDetail } from '../../shared/types';

type Props = {
  role: RoleDetail;
};

const actionLabels: Record<string, string> = {
  ROLE_CREATED: 'Роль создана',
  ROLE_UPDATED: 'Роль изменена',
  ROLE_DELETED: 'Роль удалена',
  ROLE_CLONED: 'Роль склонирована',
  ROLE_PERMISSION_UPDATED: 'Права изменены',
  USER_ROLE_CHANGED: 'Пользователь назначен',
  SYSTEM_ROLE_VIEWED: 'Просмотр роли',
  PERMISSION_MATRIX_VIEWED: 'Просмотр матрицы прав',
};

export function HistoryTab({ role }: Props) {
  const auditQuery = useQuery({
    queryKey: ['role', role.id, 'audit'],
    queryFn: () => api.roleAuditLog(role.id),
  });

  const items = auditQuery.data ?? [];

  if (auditQuery.isLoading) return <Loader />;
  if (items.length === 0) return <EmptyState title="Нет записей" description="История изменений роли пуста" />;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="enterprise-card p-3 flex items-center gap-3">
          <span className="text-[12px] text-white/30 shrink-0 w-32">{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
          <span className="text-[13px] font-semibold text-white/70 shrink-0 w-32 truncate">{item.actor?.fullName || 'Система'}</span>
          <span className="text-[12px] font-bold text-white/40 uppercase shrink-0">{actionLabels[item.action] || item.action}</span>
          {item.payload && (
            <span className="text-[12px] text-white/30 truncate">
              {renderPayload(item)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function renderPayload(item: { action: string; payload?: Record<string, unknown> }): string {
  const p = item.payload;
  if (!p) return '';
  if (p.code) return `Код: ${p.code}`;
  if (p.roleCode) return `Код: ${p.roleCode}`;
  if (p.changes) return JSON.stringify(p.changes);
  if (p.addedPermissions && Array.isArray(p.addedPermissions)) return `+${p.addedPermissions.length} прав`;
  if (p.oldRoleId && p.newRoleId) return `Смена роли`;
  return '';
}
