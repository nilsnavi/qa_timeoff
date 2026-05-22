import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, History, Pencil, Plus, Search, ShieldAlert, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Loader, Modal, Select, SkeletonCard } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { BalanceOperation, Role, Team, User } from '../shared/types';
import { confirmTelegram, getOperationTypeLabel, getRoleLabel, showAppToast } from '../shared/utils';

type BalanceAction = 'add' | 'writeOff';
type BalanceDraft = { user: User; action: BalanceAction; hours: number; reason: string };

const roles: Role[] = ['EMPLOYEE', 'LEAD', 'MANAGER', 'ADMIN'];

export function AdminPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const isAdmin = dashboard.user.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [balanceTarget, setBalanceTarget] = useState<User | null>(null);
  const [balanceAction, setBalanceAction] = useState<BalanceAction>('add');
  const [balanceConfirm, setBalanceConfirm] = useState<BalanceDraft | null>(null);
  const [operationTarget, setOperationTarget] = useState<User | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: api.users,
    enabled: isAdmin,
  });
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: api.teams,
    enabled: isAdmin,
  });
  const operationsQuery = useQuery({
    queryKey: ['balance', 'operations', operationTarget?.id],
    queryFn: () => api.userOperations(operationTarget!.id),
    enabled: isAdmin && !!operationTarget,
  });

  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const teamNames = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        [user.fullName, user.email, user.username, user.position]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      const matchesTeam = teamFilter === 'ALL' || (teamFilter === 'NO_TEAM' ? !user.teamId : user.teamId === teamFilter);

      return matchesSearch && matchesTeam;
    });
  }, [search, teamFilter, users]);

  const invalidateAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
  };

  const createUser = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      setCreateOpen(false);
      showAppToast('Пользователь создан');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось создать пользователя', 'Проверьте данные и попробуйте еще раз', 'error'),
  });
  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof api.updateUser>[1] }) => api.updateUser(id, payload),
    onSuccess: () => {
      setEditTarget(null);
      showAppToast('Пользователь обновлен');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось обновить пользователя', 'Попробуйте еще раз', 'error'),
  });
  const addBalance = useMutation({
    mutationFn: api.addBalance,
    onSuccess: () => {
      setBalanceTarget(null);
      setBalanceConfirm(null);
      showAppToast('Часы начислены');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось начислить часы', 'Проверьте операцию и попробуйте еще раз', 'error'),
  });
  const writeOffBalance = useMutation({
    mutationFn: api.writeOffBalance,
    onSuccess: () => {
      setBalanceTarget(null);
      setBalanceConfirm(null);
      showAppToast('Часы списаны');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось списать часы', 'Проверьте баланс и попробуйте еще раз', 'error'),
  });

  if (!isAdmin) {
    return (
      <EmptyState
        title="Доступ запрещен"
        description="Администрирование доступно только пользователям с ролью администратора."
        action={<ShieldAlert className="mx-auto text-rose-500" size={32} />}
      />
    );
  }

  if (usersQuery.isLoading && users.length === 0) {
    return <AdminSkeleton />;
  }

  if (usersQuery.isError && users.length === 0) {
    return (
      <ErrorState
        title="Пользователи не загрузились"
        description="Не удалось получить список сотрудников."
        onRetry={() => usersQuery.refetch()}
      />
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Администрирование</p>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Сотрудники</h2>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus size={17} />
            Создать
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Поиск" placeholder="ФИО, email, username" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select label="Команда" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
            <option value="ALL">Все команды</option>
            <option value="NO_TEAM">Без команды</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {filteredUsers.length === 0 ? (
        <EmptyState title="Сотрудников нет" description="Попробуйте изменить поиск или фильтр команды." action={<Search className="mx-auto text-blue-500" size={30} />} />
      ) : (
        <div className="grid gap-3">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              teamName={user.team?.name ?? (user.teamId ? teamNames.get(user.teamId) : undefined)}
              disabled={updateUser.isPending || addBalance.isPending || writeOffBalance.isPending}
              onEdit={() => setEditTarget(user)}
              onRoleChange={async (role) => {
                if (await confirmTelegram('Изменить роль?', `${user.fullName}: ${getRoleLabel(role)}`)) {
                  updateUser.mutate({ id: user.id, payload: { role } });
                }
              }}
              onTeamChange={async (teamId) => {
                const team = teams.find((item) => item.id === teamId);
                if (await confirmTelegram('Изменить команду?', `${user.fullName}: ${team?.name ?? 'без команды'}`)) {
                  updateUser.mutate({ id: user.id, payload: { teamId: teamId || undefined } });
                }
              }}
              teams={teams}
              onAddHours={() => {
                setBalanceTarget(user);
                setBalanceAction('add');
              }}
              onWriteOffHours={() => {
                setBalanceTarget(user);
                setBalanceAction('writeOff');
              }}
              onOpenHistory={() => setOperationTarget(user)}
            />
          ))}
        </div>
      )}

      <CreateUserModal
        open={createOpen}
        users={users}
        teams={teams}
        pending={createUser.isPending}
        error={createUser.isError ? 'Не удалось создать пользователя' : undefined}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (payload) => {
          if (await confirmTelegram('Создать пользователя?', payload.fullName)) {
            createUser.mutate(payload);
          }
        }}
      />

      <EditUserModal
        user={editTarget}
        users={users}
        teams={teams}
        pending={updateUser.isPending}
        error={updateUser.isError ? 'Не удалось обновить пользователя' : undefined}
        onClose={() => setEditTarget(null)}
        onSubmit={(id, payload) => updateUser.mutate({ id, payload })}
      />

      <BalanceModal
        user={balanceTarget}
        action={balanceAction}
        pending={addBalance.isPending || writeOffBalance.isPending}
        onClose={() => setBalanceTarget(null)}
        onSubmit={(payload) => {
          if (balanceTarget) {
            setBalanceConfirm({ user: balanceTarget, action: balanceAction, ...payload });
          }
        }}
      />

      <ConfirmBalanceModal
        draft={balanceConfirm}
        pending={addBalance.isPending || writeOffBalance.isPending}
        onClose={() => setBalanceConfirm(null)}
        onConfirm={(draft) => {
          const payload = { userId: draft.user.id, hours: draft.hours, reason: draft.reason };
          if (draft.action === 'add') {
            addBalance.mutate(payload);
          } else {
            writeOffBalance.mutate(payload);
          }
        }}
      />

      <OperationsModal
        user={operationTarget}
        operations={operationsQuery.data ?? []}
        loading={operationsQuery.isLoading}
        error={operationsQuery.isError}
        onRetry={() => operationsQuery.refetch()}
        onClose={() => setOperationTarget(null)}
      />
    </>
  );
}

function AdminSkeleton() {
  return (
    <>
      <SkeletonCard rows={3} />
      <SkeletonCard rows={5} />
      <SkeletonCard rows={5} />
    </>
  );
}

function UserCard({
  user,
  teams,
  teamName,
  disabled,
  onEdit,
  onRoleChange,
  onTeamChange,
  onAddHours,
  onWriteOffHours,
  onOpenHistory,
}: {
  user: User;
  teams: Team[];
  teamName?: string;
  disabled: boolean;
  onEdit: () => void;
  onRoleChange: (role: Role) => void;
  onTeamChange: (teamId: string) => void;
  onAddHours: () => void;
  onWriteOffHours: () => void;
  onOpenHistory: () => void;
}) {
  const balance = user.timeBalance?.balanceHours ?? 0;

  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] app-gradient text-base font-black text-white">
          {getInitials(user.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-950 dark:text-white">{user.fullName}</p>
              <p className="truncate text-sm font-bold text-slate-500 dark:text-slate-400">{user.position ?? user.email ?? 'Должность не указана'}</p>
            </div>
            <Badge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Активен' : 'Отключен'}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="gradient">{getRoleLabel(user.role)}</Badge>
            <Badge tone="info">{teamName ?? 'Без команды'}</Badge>
            <Badge tone={balance >= 0 ? 'success' : 'danger'}>{balance} ч</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Роль" value={user.role} disabled={disabled} onChange={(event) => onRoleChange(event.target.value as Role)}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {getRoleLabel(role)}
            </option>
          ))}
        </Select>
        <Select label="Команда" value={user.teamId ?? ''} disabled={disabled} onChange={(event) => onTeamChange(event.target.value)}>
          <option value="">Без команды</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Button size="sm" variant="secondary" disabled={disabled} onClick={onEdit}>
          <Pencil size={16} />
          Изменить
        </Button>
        <Button size="sm" disabled={disabled} onClick={onAddHours}>
          <Plus size={16} />
          Начислить
        </Button>
        <Button size="sm" variant="secondary" disabled={disabled} onClick={onWriteOffHours}>
          <Clock3 size={16} />
          Списать
        </Button>
        <Button size="sm" variant="secondary" onClick={onOpenHistory}>
          <History size={16} />
          История
        </Button>
        <div className="hidden items-center justify-end text-right text-xs font-bold text-slate-400 sm:flex">
          ID {user.telegramId}
        </div>
      </div>
    </Card>
  );
}

function CreateUserModal(props: {
  open: boolean;
  users: User[];
  teams: Team[];
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof api.createUser>[0]) => void;
}) {
  return <UserFormModal mode="create" {...props} />;
}

function EditUserModal({
  user,
  users,
  teams,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  user: User | null;
  users: User[];
  teams: Team[];
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (id: string, payload: Parameters<typeof api.updateUser>[1]) => void;
}) {
  return (
    <UserFormModal
      mode="edit"
      open={!!user}
      target={user}
      users={users}
      teams={teams}
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={(payload) => user && onSubmit(user.id, payload)}
    />
  );
}

function UserFormModal({
  mode,
  open,
  target,
  users,
  teams,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  open: boolean;
  target?: User | null;
  users: User[];
  teams: Team[];
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof api.createUser>[0]) => void;
}) {
  const [form, setForm] = useState({
    telegramId: '',
    fullName: '',
    username: '',
    email: '',
    position: '',
    role: 'EMPLOYEE' as Role,
    teamId: '',
    managerId: '',
    isActive: true,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm({
      telegramId: target?.telegramId ?? '',
      fullName: target?.fullName ?? '',
      username: target?.username ?? '',
      email: target?.email ?? '',
      position: target?.position ?? '',
      role: target?.role ?? 'EMPLOYEE',
      teamId: target?.teamId ?? '',
      managerId: target?.managerId ?? '',
      isActive: target?.isActive ?? true,
    });
  }, [open, target]);

  const canSubmit = form.telegramId.trim() && form.fullName.trim();

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Создать пользователя' : 'Редактировать пользователя'}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={!canSubmit || pending}
            onClick={() =>
              onSubmit({
                telegramId: form.telegramId.trim(),
                fullName: form.fullName.trim(),
                username: form.username.trim() || undefined,
                email: form.email.trim() || undefined,
                position: form.position.trim() || undefined,
                role: form.role,
                teamId: form.teamId || undefined,
                managerId: form.managerId || undefined,
                isActive: form.isActive,
              })
            }
          >
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Field label="Telegram ID" value={form.telegramId} onChange={(event) => setForm({ ...form, telegramId: event.target.value })} />
        <Field label="ФИО" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        <Field label="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        <Field label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Field label="Должность" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
        <Select label="Роль" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {getRoleLabel(role)}
            </option>
          ))}
        </Select>
        <Select label="Команда" value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}>
          <option value="">Без команды</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
        <Select label="Руководитель" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
          <option value="">Не указан</option>
          {users
            .filter((user) => user.id !== target?.id)
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
        </Select>
        <label className="flex items-center justify-between gap-3 rounded-[20px] bg-white/65 p-3 text-sm font-bold text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
          Активен
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
        </label>
        {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
      </div>
    </Modal>
  );
}

function BalanceModal({
  user,
  action,
  pending,
  onClose,
  onSubmit,
}: {
  user: User | null;
  action: BalanceAction;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { hours: number; reason: string }) => void;
}) {
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (user) {
      setHours(4);
      setReason(action === 'add' ? 'Начисление часов' : 'Списание часов');
    }
  }, [action, user]);

  return (
    <Modal
      open={!!user}
      title={action === 'add' ? 'Начислить часы' : 'Списать часы'}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant={action === 'add' ? 'primary' : 'danger'}
            disabled={!user || hours <= 0 || !reason.trim() || pending}
            onClick={() => onSubmit({ hours, reason: reason.trim() })}
          >
            Далее
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Баланс: {user.timeBalance?.balanceHours ?? 0} ч</p>
          </div>
        )}
        <Field label="Часы" type="number" min={1} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
        <Field label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
    </Modal>
  );
}

function ConfirmBalanceModal({
  draft,
  pending,
  onClose,
  onConfirm,
}: {
  draft: BalanceDraft | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (draft: BalanceDraft) => void;
}) {
  return (
    <Modal
      open={!!draft}
      title="Подтвердить операцию"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant={draft?.action === 'writeOff' ? 'danger' : 'primary'} disabled={!draft || pending} onClick={() => draft && onConfirm(draft)}>
            Подтвердить
          </Button>
        </div>
      }
    >
      {draft && (
        <div className="grid gap-3">
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{draft.user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {draft.action === 'add' ? 'Начисление' : 'Списание'}: {draft.hours} ч
            </p>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Причина: {draft.reason}</p>
        </div>
      )}
    </Modal>
  );
}

function OperationsModal({
  user,
  operations,
  loading,
  error,
  onRetry,
  onClose,
}: {
  user: User | null;
  operations: BalanceOperation[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={!!user} title="Audit log" onClose={onClose}>
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Баланс: {user.timeBalance?.balanceHours ?? 0} ч</p>
          </div>
        )}
        {loading && <Loader label="Загружаем историю" />}
        {error && !loading && (
          <ErrorState
            title="История не загрузилась"
            description="Не удалось получить операции пользователя."
            onRetry={onRetry}
          />
        )}
        {!loading && !error && operations.length === 0 && <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Операций пока нет</p>}
        {!loading &&
          operations.map((operation) => (
            <div key={operation.id} className="flex items-start justify-between gap-3 rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
              <div className="min-w-0">
                <p className="font-black text-slate-900 dark:text-white">{operation.reason}</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {getOperationTypeLabel(operation.operationType)} · {formatDateTime(operation.createdAt)}
                </p>
                {operation.createdBy && <p className="text-xs font-bold text-slate-400">Автор: {operation.createdBy.fullName}</p>}
              </div>
              <span className={`shrink-0 text-lg font-black ${operation.hours >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {operation.hours > 0 ? '+' : ''}
                {operation.hours} ч
              </span>
            </div>
          ))}
      </div>
    </Modal>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
