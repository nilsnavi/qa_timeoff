import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Info, Shield, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, Loader, Modal } from '../../components/ui';
import { api } from '../../shared/api';
import { HistoryTab } from './HistoryTab';
import { PermissionsTab } from './PermissionsTab';
import { UsersTab } from './UsersTab';

type Props = {
  roleId: string | null;
  onClose: () => void;
};

type Tab = 'info' | 'permissions' | 'users' | 'history';

export function RoleEditDrawer({ roleId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cloneCode, setCloneCode] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);

  const roleQuery = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => api.roleDetail(roleId!),
    enabled: !!roleId,
  });

  const updateMutation = useMutation({
    mutationFn: (dto: { name?: string; description?: string }) => api.updateRole(roleId!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', roleId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRole(roleId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (code: string) => api.cloneRole(roleId!, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setCloneOpen(false);
    },
  });

  const role = roleQuery.data;
  const isSystem = role?.isSystem ?? false;

  const tabs: Array<{ key: Tab; label: string; icon: typeof Shield }> = [
    { key: 'info', label: 'Основное', icon: Info },
    { key: 'permissions', label: 'Права доступа', icon: Shield },
    { key: 'users', label: 'Пользователи', icon: Users },
    { key: 'history', label: 'История', icon: History },
  ];

  const handleUpdateInfo = () => {
    updateMutation.mutate({ name: editName || undefined, description: editDesc !== undefined ? editDesc : undefined });
  };

  if (!roleId) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] border-l border-white/[0.06] bg-[#0B1220] shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Shield size={18} className={isSystem ? 'text-amber-400' : 'text-[#4C7DFF]'} />
              <h2 className="text-[16px] font-bold text-white truncate">
                {roleQuery.isLoading ? 'Загрузка...' : role?.name || 'Роль'}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {!isSystem && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => { setCloneCode(role?.code ? `${role.code}_COPY` : ''); setCloneOpen(true); }} className="!min-h-0 h-7 !px-2 text-[12px] text-white/40 hover:text-white">
                    Копировать
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(true)} className="!min-h-0 h-7 w-7 !p-0 text-rose-400">
                    <X size={14} />
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={onClose} className="!min-h-0 h-7 w-7 !p-0 text-white/40 hover:text-white">
                <X size={18} />
              </Button>
            </div>
          </div>

          <div className="flex gap-1 border-b border-white/[0.04] px-4 py-1.5 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${activeTab === tab.key ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50'}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {roleQuery.isLoading && <Loader />}

            {role && activeTab === 'info' && (
              <div className="space-y-4">
                <Field label="Название" value={editName || role.name} onChange={e => setEditName(e.target.value)} disabled={isSystem && !editName} />
                <Field label="Код роли" value={role.code} disabled />
                <Field label="Описание" value={editDesc !== undefined ? editDesc : role.description} onChange={e => setEditDesc(e.target.value)} disabled={isSystem && editDesc === undefined} />
                <div className="flex items-center gap-4 text-[13px] text-white/40">
                  <span>Тип: <span className="text-white/70">{role.isSystem ? 'Системная' : 'Пользовательская'}</span></span>
                  <span>Статус: <span className={role.isActive ? 'text-emerald-400' : 'text-rose-400'}>{role.isActive ? 'Активна' : 'Отключена'}</span></span>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-white/30">
                  <span>Создана: {new Date(role.createdAt).toLocaleDateString('ru-RU')}</span>
                  <span>Изменена: {new Date(role.updatedAt).toLocaleDateString('ru-RU')}</span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {!isSystem && (
                    <Button size="sm" onClick={() => handleUpdateInfo()} disabled={updateMutation.isPending || (!editName && editDesc === undefined)}>
                      Сохранить
                    </Button>
                  )}
                </div>
              </div>
            )}

            {role && activeTab === 'permissions' && <PermissionsTab role={role} isSystem={isSystem} />}
            {role && activeTab === 'users' && <UsersTab role={role} />}
            {role && activeTab === 'history' && <HistoryTab role={role} />}
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {deleteConfirm && (
        <Modal
          open
          title="Удалить роль?"
          onClose={() => setDeleteConfirm(false)}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirm(false)}>Отмена</Button>
              <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          }
        >
          <p className="text-[14px] text-white/60">Роль «{role?.name}» будет удалена безвозвратно. Это действие нельзя отменить.</p>
          {deleteMutation.isError && <p className="text-[13px] text-rose-400 mt-2">{(deleteMutation.error as any)?.message}</p>}
        </Modal>
      )}

      {cloneOpen && (
        <Modal
          open
          title="Копировать роль"
          onClose={() => setCloneOpen(false)}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCloneOpen(false)}>Отмена</Button>
              <Button onClick={() => cloneMutation.mutate(cloneCode)} disabled={!cloneCode.trim() || cloneMutation.isPending}>
                {cloneMutation.isPending ? 'Копирование...' : 'Копировать'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-[14px] text-white/60">Будет создана новая пользовательская роль с правами роли «{role?.name}».</p>
            <Field label="Код новой роли" value={cloneCode} onChange={e => setCloneCode(e.target.value)} placeholder="КОПИЯ_РОЛИ" />
          </div>
        </Modal>
      )}
    </>
  );
}
