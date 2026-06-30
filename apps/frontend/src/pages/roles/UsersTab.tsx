import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, EmptyState, Loader, Modal } from '../../components/ui';
import { api } from '../../shared/api';
import type { RoleDetail } from '../../shared/types';

type Props = {
  role: RoleDetail;
};

export function UsersTab({ role }: Props) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const usersQuery = useQuery({
    queryKey: ['role', role.id, 'users'],
    queryFn: () => api.roleUsers(role.id),
  });
  const allUsersQuery = useQuery({
    queryKey: ['admin', 'users', '', 'ALL', 'ALL'],
    queryFn: () => api.adminUsers(),
    enabled: addOpen,
  });

  const users = usersQuery.data ?? [];
  const allUsers = allUsersQuery.data ?? [];
  const userIds = new Set(users.map(u => u.id));
  const availableUsers = allUsers.filter(u => !userIds.has(u.id) && u.isActive);

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeRoleUser(role.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['role', role.id, 'users'] }),
  });

  const addMutation = useMutation({
    mutationFn: (userIds: string[]) => api.addRoleUsers(role.id, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role', role.id, 'users'] });
      setAddOpen(false);
      setSelectedUsers([]);
    },
  });

  if (usersQuery.isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-white/40 uppercase">Пользователи ({users.length})</span>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          Добавить пользователя
        </Button>
      </div>

      {users.length === 0 && (
        <EmptyState title="Нет пользователей" description="Никто не назначен на эту роль" />
      )}

      {users.map(u => (
        <div key={u.id} className="enterprise-card p-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white/90">{u.fullName}</p>
            <p className="text-[12px] text-white/30">{u.email || '—'} {u.position ? `· ${u.position}` : ''} {u.team ? `· ${u.team.name}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {u.isActive ? (
              <span className="text-[12px] text-emerald-400/70">Активен</span>
            ) : (
              <span className="text-[12px] text-rose-400/70">Заблокирован</span>
            )}
            <Button size="sm" variant="ghost" className="!min-h-0 h-7 !px-2 text-[12px] text-rose-400" onClick={() => { if (window.confirm(`Убрать ${u.fullName} из роли?`)) removeMutation.mutate(u.id); }}>
              Убрать
            </Button>
          </div>
        </div>
      ))}

      {addOpen && (
        <Modal
          open
          title={`Добавить пользователей в роль «${role.name}»`}
          onClose={() => { setAddOpen(false); setSelectedUsers([]); }}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setAddOpen(false); setSelectedUsers([]); }}>Отмена</Button>
              <Button onClick={() => addMutation.mutate(selectedUsers)} disabled={selectedUsers.length === 0 || addMutation.isPending}>
                {addMutation.isPending ? 'Добавление...' : `Добавить (${selectedUsers.length})`}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-[14px] text-white/60">Выберите пользователей для назначения на эту роль:</p>
            {allUsersQuery.isLoading ? <Loader /> : (
              <div className="max-h-80 overflow-y-auto space-y-1.5">
                {availableUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(v => v !== u.id) : [...prev, u.id])}
                      className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-[#4C7DFF]"
                    />
                    <div>
                      <span className="text-[14px] text-white/80">{u.fullName}</span>
                      <span className="text-[12px] text-white/30 ml-2">{u.email || '—'}</span>
                    </div>
                  </label>
                ))}
                {availableUsers.length === 0 && <p className="text-[13px] text-white/30 py-4 text-center">Все активные пользователи уже имеют роль</p>}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
