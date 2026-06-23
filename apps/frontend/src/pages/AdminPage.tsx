import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Brain, CalendarDays, Clock3, Download, FileSpreadsheet, History, Pencil, Plus, Search, ShieldAlert, TrendingUp, UserPlus, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Loader, Modal, Select, SkeletonCard } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { AiForecast, BalanceOperation, KpiPeriod, Overtime, PayrollReport, RiskLevel, Role, Team, User, WorkloadReport } from '../shared/types';
import { confirmTelegram, getOperationTypeLabel, getRoleLabel, showAppToast } from '../shared/utils';

type BalanceAction = 'add' | 'writeOff';
type BalanceDraft = { user: User; action: BalanceAction; hours: number; reason: string };
type AdminTab = 'employees' | 'overtime-calendar' | 'overtime-report' | 'payroll' | 'kpi' | 'analytics' | 'ai-forecast' | 'export';

const roles: Role[] = ['EMPLOYEE', 'LEAD', 'MANAGER', 'ADMIN'];

const positionOptions = [
  'QA Engineer',
  'Senior QA Engineer',
  'Lead QA Engineer',
  'QA Manager',
  'Automation QA Engineer',
  'SAP EWM QA Engineer',
  'System Administrator',
  'DevOps Engineer',
  'Product Owner',
  'Scrum Master',
  'Business Analyst',
];

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
  const [activeTab, setActiveTab] = useState<AdminTab>('employees');

  // Position management
  const [positionTarget, setPositionTarget] = useState<User | null>(null);
  const [positionHistoryTarget, setPositionHistoryTarget] = useState<User | null>(null);

  // Overtime management
  const [overtimeTarget, setOvertimeTarget] = useState<User | null>(null);
  const [userOvertimeTarget, setUserOvertimeTarget] = useState<User | null>(null);

  // Hourly rate
  const [hourlyRateTarget, setHourlyRateTarget] = useState<User | null>(null);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: isAdmin });
  const operationsQuery = useQuery({
    queryKey: ['balance', 'operations', operationTarget?.id],
    queryFn: () => api.userOperations(operationTarget!.id),
    enabled: isAdmin && !!operationTarget,
  });
  const positionHistoryQuery = useQuery({
    queryKey: ['position-history', positionHistoryTarget?.id],
    queryFn: () => api.positionHistory(positionHistoryTarget!.id),
    enabled: isAdmin && !!positionHistoryTarget,
  });
  const userOvertimeQuery = useQuery({
    queryKey: ['overtime', 'user', userOvertimeTarget?.id],
    queryFn: () => api.userOvertime(userOvertimeTarget!.id),
    enabled: isAdmin && !!userOvertimeTarget,
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
    queryClient.invalidateQueries({ queryKey: ['overtime'] });
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
  const updatePosition = useMutation({
    mutationFn: ({ userId, position }: { userId: string; position: string }) => api.updatePosition(userId, position),
    onSuccess: () => {
      setPositionTarget(null);
      showAppToast('Должность обновлена');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось обновить должность', 'Попробуйте еще раз', 'error'),
  });
  const addOvertime = useMutation({
    mutationFn: api.addOvertime,
    onSuccess: () => {
      setOvertimeTarget(null);
      showAppToast('Переработка добавлена');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось добавить переработку', 'Попробуйте еще раз', 'error'),
  });
  const updateHourlyRate = useMutation({
    mutationFn: ({ userId, hourlyRate }: { userId: string; hourlyRate: number }) =>
      api.updateHourlyRate(userId, hourlyRate),
    onSuccess: () => {
      showAppToast('Ставка обновлена');
      invalidateAdminData();
    },
    onError: () => showAppToast('Не удалось обновить ставку', 'Попробуйте еще раз', 'error'),
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
    return <ErrorState title="Пользователи не загрузились" description="Не удалось получить список сотрудников." onRetry={() => usersQuery.refetch()} />;
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'employees', label: 'Сотрудники', icon: <UserPlus size={16} /> },
    { key: 'overtime-calendar', label: 'Календарь', icon: <CalendarDays size={16} /> },
    { key: 'overtime-report', label: 'Отчёт по переработкам', icon: <BarChart3 size={16} /> },
    { key: 'payroll', label: 'Расчёт стоимости', icon: <Wallet size={16} /> },
    { key: 'kpi', label: 'KPI', icon: <TrendingUp size={16} /> },
    { key: 'analytics', label: 'Графики нагрузки', icon: <BarChart3 size={16} /> },
    { key: 'ai-forecast', label: 'AI прогноз', icon: <Brain size={16} /> },
    { key: 'export', label: 'Экспорт', icon: <Download size={16} /> },
  ];

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Администрирование</p>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">HR + Workforce Management</h2>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={activeTab === tab.key ? 'primary' : 'secondary'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>

      {activeTab === 'employees' && (
        <>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px] flex-1">
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
              <Button size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
                <UserPlus size={17} />
                Создать
              </Button>
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
                  teams={teams}
                  teamName={user.team?.name ?? (user.teamId ? teamNames.get(user.teamId) : undefined)}
                  disabled={updateUser.isPending || addBalance.isPending || writeOffBalance.isPending || updatePosition.isPending}
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
                  onAddHours={() => {
                    setBalanceTarget(user);
                    setBalanceAction('add');
                  }}
                  onWriteOffHours={() => {
                    setBalanceTarget(user);
                    setBalanceAction('writeOff');
                  }}
                  onOpenHistory={() => setOperationTarget(user)}
                  onChangePosition={() => setPositionTarget(user)}
                  onPositionHistory={() => setPositionHistoryTarget(user)}
                  onAddOvertime={() => setOvertimeTarget(user)}
                  onViewOvertime={() => setUserOvertimeTarget(user)}
                  onChangeHourlyRate={() => setHourlyRateTarget(user)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'overtime-calendar' && <OvertimeCalendarView isAdmin={isAdmin} />}
      {activeTab === 'overtime-report' && <OvertimeReportView isAdmin={isAdmin} />}
      {activeTab === 'payroll' && <PayrollReportView isAdmin={isAdmin} />}
      {activeTab === 'kpi' && <KpiView isAdmin={isAdmin} />}
      {activeTab === 'analytics' && <AnalyticsView isAdmin={isAdmin} />}
      {activeTab === 'ai-forecast' && <AiForecastView isAdmin={isAdmin} />}
      {activeTab === 'export' && <ExportView />}

      {/* Modals */}
      <UserFormModal
        mode="create"
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

      <UserFormModal
        mode="edit"
        open={!!editTarget}
        target={editTarget}
        users={users}
        teams={teams}
        pending={updateUser.isPending}
        error={updateUser.isError ? 'Не удалось обновить пользователя' : undefined}
        onClose={() => setEditTarget(null)}
        onSubmit={(payload) => editTarget && updateUser.mutate({ id: editTarget.id, payload })}
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

      <PositionModal
        user={positionTarget}
        pending={updatePosition.isPending}
        onClose={() => setPositionTarget(null)}
        onSubmit={({ position }) => {
          if (positionTarget) {
            updatePosition.mutate({ userId: positionTarget.id, position });
          }
        }}
      />

      <PositionHistoryModal
        user={positionHistoryTarget}
        history={positionHistoryQuery.data ?? []}
        loading={positionHistoryQuery.isLoading}
        onClose={() => setPositionHistoryTarget(null)}
      />

      <OvertimeModal
        user={overtimeTarget}
        pending={addOvertime.isPending}
        onClose={() => setOvertimeTarget(null)}
        onSubmit={(payload) => {
          if (overtimeTarget) {
            addOvertime.mutate({ userId: overtimeTarget.id, ...payload });
          }
        }}
      />

      <UserOvertimeModal
        user={userOvertimeTarget}
        overtimes={userOvertimeQuery.data ?? []}
        loading={userOvertimeQuery.isLoading}
        onClose={() => setUserOvertimeTarget(null)}
      />

      {/* Hourly Rate Modal */}
      <HourlyRateModal
        user={hourlyRateTarget}
        pending={updateHourlyRate.isPending}
        onClose={() => setHourlyRateTarget(null)}
        onSubmit={({ hourlyRate }) => {
          if (hourlyRateTarget) {
            updateHourlyRate.mutate({ userId: hourlyRateTarget.id, hourlyRate });
            setHourlyRateTarget(null);
          }
        }}
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
  onChangePosition,
  onPositionHistory,
  onAddOvertime,
  onViewOvertime,
  onChangeHourlyRate,
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
  onChangePosition: () => void;
  onPositionHistory: () => void;
  onAddOvertime: () => void;
  onViewOvertime: () => void;
  onChangeHourlyRate: () => void;
}) {
  const balance = user.timeBalance?.balanceHours ?? 0;

  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] app-gradient text-base font-black text-white">{getInitials(user.fullName)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-950 dark:text-white">{user.fullName}</p>
              <p className="truncate text-sm font-bold text-slate-500 dark:text-slate-400">{user.position ?? user.email ?? 'Должность не указана'}</p>
              {user.hourlyRate ? (
                <p className="text-xs font-bold text-slate-400">{user.hourlyRate} ₽/ч</p>
              ) : null}
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

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        <Button size="sm" variant="secondary" onClick={onChangePosition}>
          <Pencil size={16} />
          Должность
        </Button>
        <Button size="sm" variant="secondary" onClick={onPositionHistory}>
          <History size={16} />
          Ист.должн.
        </Button>
        <Button size="sm" disabled={disabled} onClick={onAddOvertime}>
          <Plus size={16} />
          Переработка
        </Button>
        <Button size="sm" variant="secondary" onClick={onViewOvertime}>
          <Clock3 size={16} />
          Переработки
        </Button>
        <Button size="sm" variant="secondary" onClick={onChangeHourlyRate}>
          <Wallet size={16} />
          Ставка
        </Button>
      </div>
    </Card>
  );
}

// ── Position Modal ──────────────────────────────────────────────────────

function PositionModal({
  user,
  pending,
  onClose,
  onSubmit,
}: {
  user: User | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { position: string }) => void;
}) {
  const [position, setPosition] = useState('');

  useEffect(() => {
    if (user) {
      setPosition(user.position ?? '');
    }
  }, [user]);

  return (
    <Modal
      open={!!user}
      title="Изменить должность"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!position.trim() || pending} onClick={() => onSubmit({ position: position.trim() })}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Текущая: {user.position ?? 'не указана'}</p>
          </div>
        )}
        <Select label="Новая должность" value={position} onChange={(event) => setPosition(event.target.value)}>
          <option value="">Выберите должность</option>
          {positionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
        <Field
          label="Или введите вручную"
          placeholder="Другая должность"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        />
      </div>
    </Modal>
  );
}

// ── Position History Modal ──────────────────────────────────────────────

function PositionHistoryModal({
  user,
  history,
  loading,
  onClose,
}: {
  user: User | null;
  history: Array<{ id: string; position: string; changer: { fullName: string }; changedAt: string }>;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={!!user} title="История должностей" onClose={onClose}>
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Текущая: {user.position ?? 'не указана'}</p>
          </div>
        )}
        {loading && <Loader label="Загружаем историю" />}
        {!loading && history.length === 0 && (
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">История изменений пуста</p>
        )}
        {!loading &&
          history.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between gap-3 rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
              <div className="min-w-0">
                <p className="font-black text-slate-900 dark:text-white">{entry.position}</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {formatDateTime(entry.changedAt)} · {entry.changer.fullName}
                </p>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  );
}

// ── Overtime Modal ──────────────────────────────────────────────────────

function OvertimeModal({
  user,
  pending,
  onClose,
  onSubmit,
}: {
  user: User | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { hours: number; date: string; reason: string }) => void;
}) {
  const [hours, setHours] = useState(2);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (user) {
      setHours(2);
      setDate(new Date().toISOString().split('T')[0]);
      setReason('');
    }
  }, [user]);

  return (
    <Modal
      open={!!user}
      title="Добавить переработку"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!user || hours <= 0 || !date || !reason.trim() || pending} onClick={() => onSubmit({ hours, date, reason: reason.trim() })}>
            Добавить
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{user.position ?? 'Должность не указана'}</p>
          </div>
        )}
        <Field label="Часы" type="number" min={1} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
        <Field label="Дата" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Field label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
    </Modal>
  );
}

// ── User Overtime Modal ─────────────────────────────────────────────────

function UserOvertimeModal({
  user,
  overtimes,
  loading,
  onClose,
}: {
  user: User | null;
  overtimes: Overtime[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={!!user} title="Переработки сотрудника" onClose={onClose}>
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
          </div>
        )}
        {loading && <Loader label="Загружаем переработки" />}
        {!loading && overtimes.length === 0 && (
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Переработок пока нет</p>
        )}
        {!loading &&
          overtimes.map((ot) => (
            <div key={ot.id} className="flex items-start justify-between gap-3 rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
              <div className="min-w-0">
                <p className="font-black text-slate-900 dark:text-white">{ot.reason}</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {formatDateTime(ot.date)} · {ot.createdBy?.fullName ?? 'Система'}
                </p>
              </div>
              <span className="shrink-0 text-lg font-black text-amber-500">+{ot.hours} ч</span>
            </div>
          ))}
      </div>
    </Modal>
  );
}

// ── Overtime Calendar View ──────────────────────────────────────────────

function OvertimeCalendarView({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [userFilter, setUserFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: isAdmin });
  const calendarQuery = useQuery({
    queryKey: ['overtime', 'calendar', currentYear, currentMonth, userFilter, teamFilter],
    queryFn: () =>
      api.overtimeCalendar({
        year: currentYear,
        month: currentMonth,
        userId: userFilter || undefined,
        teamId: teamFilter !== 'ALL' ? teamFilter : undefined,
      }),
    enabled: isAdmin,
  });

  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const calendarData = calendarQuery.data ?? [];

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0=Sun
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  // Build a map of date -> entries
  const dateMap = new Map<string, (typeof calendarData)[0]>();
  for (const entry of calendarData) {
    dateMap.set(entry.date, entry);
  }

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="secondary" onClick={prevMonth}>
          ←
        </Button>
        <p className="text-lg font-black text-slate-950 dark:text-white">{monthName}</p>
        <Button size="sm" variant="secondary" onClick={nextMonth}>
          →
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Сотрудник" value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
          <option value="">Все сотрудники</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>
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

      {calendarQuery.isLoading && <Loader label="Загружаем календарь" />}

      {!calendarQuery.isLoading && (
        <div className="mt-4">
          {/* Legend */}
          <div className="mb-3 flex flex-wrap gap-3 text-xs font-bold">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Норма (≤4 ч)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-orange-500" /> Переработка (4-8 ч)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Перегруз ({'>'}8 ч)
            </span>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {dayLabels.map((label) => (
              <div key={label} className="p-2 text-center text-xs font-bold text-slate-500">
                {label}
              </div>
            ))}

            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[60px] rounded-lg bg-white/30 p-1 dark:bg-slate-900/30" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entry = dateMap.get(dateStr);
              const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div
                  key={day}
                  className={`min-h-[60px] rounded-lg border-2 p-1 ${
                    isWeekend ? 'bg-slate-100 dark:bg-slate-800/50' : 'bg-white/50 dark:bg-slate-900/50'
                  } ${entry ? '' : 'border-transparent'}`}
                  style={entry ? { borderColor: entry.color } : undefined}
                >
                  <p className={`text-xs font-bold ${isWeekend ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {day}
                  </p>
                  {entry && (
                    <div className="mt-1">
                      <div
                        className="rounded-md px-1 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: entry.color }}
                      >
                        {entry.totalHours}ч
                      </div>
                      <p className="mt-0.5 truncate text-[9px] text-slate-500">{entry.userName}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed list */}
          {calendarData.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Детали:</p>
              <div className="grid gap-2">
                {calendarData.map((entry, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 dark:text-white">{entry.userName}</p>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        {entry.date} · {entry.team?.name ?? 'Без команды'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-sm font-black text-white"
                        style={{ backgroundColor: entry.color }}
                      >
                        {entry.totalHours} ч
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!calendarQuery.isLoading && calendarData.length === 0 && (
            <p className="mt-4 text-center text-sm font-bold text-slate-500">Нет переработок за этот период</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Overtime Report View ────────────────────────────────────────────────

function OvertimeReportView({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const reportQuery = useQuery({
    queryKey: ['overtime', 'report', startDate, endDate],
    queryFn: () => api.overtimeReport({ startDate, endDate }),
    enabled: isAdmin,
  });

  const report = reportQuery.data;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950 dark:text-white">Отчёт по переработкам</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Начало" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Field label="Конец" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </div>

      {reportQuery.isLoading && <Loader label="Загружаем отчёт" />}

      {reportQuery.isError && (
        <ErrorState title="Ошибка загрузки" description="Не удалось загрузить отчёт." onRetry={() => reportQuery.refetch()} />
      )}

      {report && (
        <div className="mt-4 grid gap-4">
          {/* Summary */}
          <div className="rounded-[20px] bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white">
            <p className="text-2xl font-black">{report.totalOvertimeHours} ч</p>
            <p className="text-sm font-bold text-white/80">Всего переработок за период</p>
          </div>

          {/* Top employees */}
          {report.topEmployees.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Топ сотрудников:</p>
              <div className="grid gap-2">
                {report.topEmployees.map((emp, idx) => (
                  <div key={emp.userId} className="flex items-center justify-between gap-3 rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-400">#{idx + 1}</span>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">{emp.fullName}</p>
                        <p className="text-xs font-bold text-slate-500">{emp.teamName}</p>
                      </div>
                    </div>
                    <span className="text-lg font-black text-amber-500">{emp.totalHours} ч</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department breakdown */}
          {report.departments.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">По отделам:</p>
              <div className="grid gap-3">
                {report.departments.map((dept) => (
                  <div key={dept.department} className="rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-black text-slate-900 dark:text-white">{dept.department}</p>
                      <Badge tone="info">{dept.departmentTotal} ч</Badge>
                    </div>
                    <div className="grid gap-1">
                      {dept.users.map((u) => (
                        <div key={u.userId} className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-600 dark:text-slate-300">{u.fullName}</span>
                          <span className="font-black text-slate-500">{u.totalHours} ч</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!reportQuery.isLoading && report.departments.length === 0 && (
            <p className="text-center text-sm font-bold text-slate-500">Нет данных за выбранный период</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Payroll Report View ─────────────────────────────────────────────────

function PayrollReportView({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const payrollQuery = useQuery({
    queryKey: ['payroll', 'report', startDate, endDate],
    queryFn: () => api.payrollReport({ startDate, endDate }),
    enabled: isAdmin,
  });

  const report = payrollQuery.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950 dark:text-white">Расчёт стоимости переработок</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Начало" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Field label="Конец" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </div>

      {payrollQuery.isLoading && <Loader label="Загружаем расчёт" />}

      {payrollQuery.isError && (
        <ErrorState title="Ошибка загрузки" description="Не удалось загрузить расчёт." onRetry={() => payrollQuery.refetch()} />
      )}

      {report && (
        <div className="mt-4 grid gap-4">
          {/* Grand total */}
          <div className="rounded-[20px] bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
            <p className="text-2xl font-black">{formatCurrency(report.grandTotal)}</p>
            <p className="text-sm font-bold text-white/80">Общая стоимость переработок</p>
          </div>

          {/* Multiplier info */}
          <div className="rounded-[18px] bg-white/65 p-3 text-xs font-bold text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <p>Коэффициенты: будни ×1.0 · выходные ×1.5 · праздники ×2.0</p>
          </div>

          {/* Employee breakdown */}
          {report.employees.length > 0 ? (
            <div className="grid gap-3">
              {report.employees.map((emp) => (
                <div key={emp.userId} className="rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white">{emp.fullName}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {emp.teamName} · {emp.hourlyRate} ₽/ч · {emp.totalHours} ч всего
                      </p>
                    </div>
                    <span className="text-lg font-black text-emerald-500">{formatCurrency(emp.totalCost)}</span>
                  </div>
                  <div className="grid gap-1">
                    {emp.details.map((det, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500">
                          {det.date} · {det.hours}ч × {emp.hourlyRate}₽ × {det.multiplier}
                        </span>
                        <span className="font-black text-slate-600 dark:text-slate-300">{formatCurrency(det.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm font-bold text-slate-500">Нет данных за выбранный период</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Existing Modals (unchanged) ─────────────────────────────────────────

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
    hourlyRate: 0,
    role: 'EMPLOYEE' as Role,
    teamId: '',
    managerId: '',
    isActive: true,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      telegramId: target?.telegramId ?? '',
      fullName: target?.fullName ?? '',
      username: target?.username ?? '',
      email: target?.email ?? '',
      position: target?.position ?? '',
      hourlyRate: target?.hourlyRate ?? 0,
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
        <Field label="Ставка (₽/ч)" type="number" min={0} value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: Number(event.target.value) })} />
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
          <Button variant={action === 'add' ? 'primary' : 'danger'} disabled={!user || hours <= 0 || !reason.trim() || pending} onClick={() => onSubmit({ hours, reason: reason.trim() })}>
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
    <Modal open={!!user} title="История операций" onClose={onClose}>
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Баланс: {user.timeBalance?.balanceHours ?? 0} ч</p>
          </div>
        )}
        {loading && <Loader label="Загружаем историю" />}
        {error && !loading && <ErrorState title="История не загрузилась" description="Не удалось получить операции пользователя." onRetry={onRetry} />}
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

// ── KPI View ────────────────────────────────────────────────────────────

function KpiView({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const kpiQuery = useQuery({
    queryKey: ['kpi', month, year],
    queryFn: () => api.kpiList({ month, year }),
    enabled: isAdmin,
  });

  const recalculateMutation = useMutation({
    mutationFn: api.recalculateKpi,
    onSuccess: (data) => {
      showAppToast(`KPI пересчитаны для ${data.results.length} сотрудников`);
      kpiQuery.refetch();
    },
    onError: () => showAppToast('Ошибка пересчёта KPI', '', 'error'),
  });

  const kpiData = kpiQuery.data;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-gradient-to-br from-emerald-500 to-teal-600';
    if (score >= 50) return 'bg-gradient-to-br from-amber-500 to-orange-600';
    return 'bg-gradient-to-br from-rose-500 to-red-600';
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950 dark:text-white">KPI сотрудников</p>
        <Button size="sm" disabled={recalculateMutation.isPending} onClick={() => recalculateMutation.mutate()}>
          <TrendingUp size={16} />
          Пересчитать
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Месяц" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('ru-RU', { month: 'long' })}
            </option>
          ))}
        </Select>
        <Field label="Год" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      {kpiQuery.isLoading && <Loader label="Загружаем KPI" />}
      {kpiQuery.isError && <ErrorState title="Ошибка" description="Не удалось загрузить KPI" onRetry={() => kpiQuery.refetch()} />}

      {kpiData && kpiData.items.length === 0 && (
        <EmptyState title="Нет данных KPI" description="Нажмите «Пересчитать» для генерации KPI" action={<TrendingUp className="mx-auto text-blue-500" size={30} />} />
      )}

      {kpiData && kpiData.items.length > 0 && (
        <div className="mt-4 grid gap-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[20px] bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white">
              <p className="text-2xl font-black">{kpiData.items.filter((k) => k.kpiScore >= 80).length}</p>
              <p className="text-xs font-bold text-white/80">Высокий KPI</p>
            </div>
            <div className="rounded-[20px] bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
              <p className="text-2xl font-black">{kpiData.items.filter((k) => k.kpiScore >= 50 && k.kpiScore < 80).length}</p>
              <p className="text-xs font-bold text-white/80">Средний KPI</p>
            </div>
            <div className="rounded-[20px] bg-gradient-to-br from-rose-500 to-red-600 p-4 text-white">
              <p className="text-2xl font-black">{kpiData.items.filter((k) => k.kpiScore < 50).length}</p>
              <p className="text-xs font-bold text-white/80">Низкий KPI</p>
            </div>
            <div className="rounded-[20px] bg-gradient-to-br from-purple-500 to-violet-600 p-4 text-white">
              <p className="text-2xl font-black">{kpiData.items.length}</p>
              <p className="text-xs font-bold text-white/80">Всего</p>
            </div>
          </div>

          {/* Employee KPI cards */}
          {kpiData.items.map((kpi) => (
            <div key={kpi.id} className="rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900 dark:text-white">{kpi.user?.fullName ?? 'Unknown'}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {kpi.user?.position ?? 'Без должности'} · {kpi.user?.team?.name ?? 'Без команды'}
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-lg font-black text-white ${getScoreBg(kpi.kpiScore)}`}>
                  {kpi.kpiScore}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <p className="font-bold text-slate-400">Надёжность</p>
                  <p className={`font-black ${getScoreColor(kpi.reliabilityScore)}`}>{kpi.reliabilityScore}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400">Нагрузка</p>
                  <p className={`font-black ${getScoreColor(kpi.workloadScore)}`}>{kpi.workloadScore}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400">Переработки</p>
                  <p className="font-black text-amber-500">{kpi.overtimeHours} ч</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400">Заявки</p>
                  <p className="font-black text-slate-600 dark:text-slate-300">
                    ✓{kpi.approvedRequests} ✗{kpi.rejectedRequests}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Analytics / Workload View ───────────────────────────────────────────

function AnalyticsView({ isAdmin }: { isAdmin: boolean }) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const workloadQuery = useQuery({
    queryKey: ['workload', startDate, endDate],
    queryFn: () => api.workloadReport({ startDate, endDate }),
    enabled: isAdmin,
  });

  const data = workloadQuery.data;

  const maxHours = (arr: Array<{ hours: number }>) => Math.max(...arr.map((d) => d.hours), 1);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950 dark:text-white">Графики нагрузки</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Начало" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Field label="Конец" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {workloadQuery.isLoading && <Loader label="Загружаем данные" />}
      {workloadQuery.isError && <ErrorState title="Ошибка" description="Не удалось загрузить данные" onRetry={() => workloadQuery.refetch()} />}

      {data && (
        <div className="mt-4 grid gap-4">
          {/* Workload by day - simple bar chart */}
          <div>
            <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Нагрузка по дням</p>
            <div className="flex items-end gap-1 overflow-x-auto pb-2">
              {data.workloadByDay.length === 0 && <p className="text-sm text-slate-500">Нет данных</p>}
              {data.workloadByDay.slice(-30).map((day) => {
                const height = Math.max(4, (day.hours / maxHours(data.workloadByDay)) * 100);
                return (
                  <div key={day.date} className="flex flex-col items-center" title={`${day.date}: ${day.hours} ч`}>
                    <div className="w-6 rounded-t bg-blue-500" style={{ height: `${height}px` }} />
                    <span className="mt-1 text-[8px] font-bold text-slate-400">{day.date.slice(8)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top overloaded users */}
          <div>
            <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Топ перегруженных сотрудников</p>
            <div className="grid gap-2">
              {data.topOverloaded.length === 0 && <p className="text-sm text-slate-500">Нет данных</p>}
              {data.topOverloaded.map((user, idx) => (
                <div key={user.userId} className="flex items-center justify-between rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-400">#{idx + 1}</span>
                    <p className="font-black text-slate-900 dark:text-white">{user.fullName}</p>
                  </div>
                  <span className="text-lg font-black text-amber-500">{user.totalHours} ч</span>
                </div>
              ))}
            </div>
          </div>

          {/* Workload by team */}
          <div>
            <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Нагрузка по командам</p>
            <div className="grid gap-2">
              {data.workloadByTeam.length === 0 && <p className="text-sm text-slate-500">Нет данных</p>}
              {data.workloadByTeam.map((team) => {
                const pct = team.totalHours > 0 ? Math.round((team.totalHours / data.workloadByTeam[0].totalHours) * 100) : 0;
                return (
                  <div key={team.teamName} className="rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white">{team.teamName}</p>
                      <span className="font-black text-slate-500">{team.totalHours} ч</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overtime trend */}
          {data.overtimeTrend.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Тренд переработок</p>
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {data.overtimeTrend.map((trend) => {
                  const height = Math.max(4, (trend.hours / maxHours(data.overtimeTrend)) * 100);
                  return (
                    <div key={trend.month} className="flex flex-col items-center">
                      <div className="w-10 rounded-t bg-orange-500" style={{ height: `${height}px` }} />
                      <span className="mt-1 text-[9px] font-bold text-slate-400">{trend.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── AI Forecast View ────────────────────────────────────────────────────

function AiForecastView({ isAdmin }: { isAdmin: boolean }) {
  const [teamFilter, setTeamFilter] = useState('');

  const forecastQuery = useQuery({
    queryKey: ['ai-forecast', teamFilter],
    queryFn: () => api.aiForecast({ teamId: teamFilter || undefined }),
    enabled: isAdmin,
  });

  const forecast = forecastQuery.data;

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'HIGH': return 'text-rose-500';
      case 'MEDIUM': return 'text-amber-500';
      default: return 'text-emerald-500';
    }
  };

  const getRiskBg = (risk: RiskLevel) => {
    switch (risk) {
      case 'HIGH': return 'bg-gradient-to-br from-rose-500 to-red-600';
      case 'MEDIUM': return 'bg-gradient-to-br from-amber-500 to-orange-600';
      default: return 'bg-gradient-to-br from-emerald-500 to-teal-600';
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950 dark:text-white">AI прогноз переработок</p>
        <Button size="sm" disabled={forecastQuery.isFetching} onClick={() => forecastQuery.refetch()}>
          <Brain size={16} />
          Обновить прогноз
        </Button>
      </div>

      <div className="mt-3">
        <Field label="Команда (фильтр)" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} placeholder="Оставьте пустым для всех" />
      </div>

      {forecastQuery.isLoading && <Loader label="Генерируем прогноз" />}
      {forecastQuery.isError && <ErrorState title="Ошибка" description="Не удалось получить прогноз" onRetry={() => forecastQuery.refetch()} />}

      {forecast && (
        <div className="mt-4 grid gap-4">
          {/* Risk level card */}
          <div className={`rounded-[20px] p-4 text-white ${getRiskBg(forecast.riskLevel)}`}>
            <p className="text-sm font-bold text-white/80">Уровень риска</p>
            <p className="text-2xl font-black">{forecast.riskLevel === 'HIGH' ? 'Высокий' : forecast.riskLevel === 'MEDIUM' ? 'Средний' : 'Низкий'}</p>
            <p className="mt-1 text-sm font-bold text-white/80">Прогноз переработок: {forecast.predictedOvertimeHours} ч</p>
          </div>

          {/* Overloaded users */}
          {forecast.overloadedUsers.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Прогноз по сотрудникам</p>
              <div className="grid gap-2">
                {forecast.overloadedUsers.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between rounded-[18px] bg-white/65 p-3 dark:bg-slate-900/60">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-white">{user.fullName}</p>
                      <p className="text-xs font-bold text-slate-500">{user.teamName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">{user.currentOvertime} → {user.predictedOvertime} ч</span>
                      <span className={`font-black ${getRiskColor(user.riskLevel)}`}>
                        {user.riskLevel === 'HIGH' ? '🔴' : user.riskLevel === 'MEDIUM' ? '🟡' : '🟢'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {forecast.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Рекомендации</p>
              <div className="grid gap-2">
                {forecast.recommendations.map((rec, idx) => (
                  <div key={idx} className="rounded-[18px] bg-blue-50 p-3 text-sm font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    💡 {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs font-bold text-slate-400">
            Прогноз сгенерирован: {new Date(forecast.generatedAt).toLocaleString('ru-RU')}
          </p>
        </div>
      )}
    </Card>
  );
}

// ── Export View ────────────────────────────────────────────────────────

function ExportView() {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [kpiMonth, setKpiMonth] = useState(now.getMonth() + 1);
  const [kpiYear, setKpiYear] = useState(now.getFullYear());

  const downloadUrl = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    showAppToast(`Скачивание: ${filename}`);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-slate-950 dark:text-white">Экспорт данных</p>
      </div>

      <div className="mt-4 grid gap-4">
        {/* Overtime export */}
        <div className="rounded-[18px] bg-white/65 p-4 dark:bg-slate-900/60">
          <p className="mb-2 font-black text-slate-900 dark:text-white">Экспорт переработок</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Начало" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Field label="Конец" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadUrl(api.exportOvertimeCsv({ startDate, endDate }), 'overtime.csv')}>
              <FileSpreadsheet size={16} />
              Excel (CSV)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadUrl(api.exportPayrollCsv({ startDate, endDate }), 'payroll.csv')}>
              <Wallet size={16} />
              Расчёт стоимости
            </Button>
          </div>
        </div>

        {/* KPI export */}
        <div className="rounded-[18px] bg-white/65 p-4 dark:bg-slate-900/60">
          <p className="mb-2 font-black text-slate-900 dark:text-white">Экспорт KPI</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Месяц" value={kpiMonth} onChange={(e) => setKpiMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('ru-RU', { month: 'long' })}
                </option>
              ))}
            </Select>
            <Field label="Год" type="number" value={kpiYear} onChange={(e) => setKpiYear(Number(e.target.value))} />
          </div>
          <div className="mt-3">
            <Button size="sm" onClick={() => downloadUrl(api.exportKpiCsv({ month: kpiMonth, year: kpiYear }), 'kpi.csv')}>
              <Download size={16} />
              KPI (CSV)
            </Button>
          </div>
        </div>

        {/* 1C Export */}
        <div className="rounded-[18px] bg-white/65 p-4 dark:bg-slate-900/60">
          <p className="mb-2 font-black text-slate-900 dark:text-white">Экспорт для 1C</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Начало" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Field label="Конец" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => downloadUrl(api.export1cOvertimeCsv({ startDate, endDate }), '1c_overtime.csv')}>
              <Download size={16} />
              1C Переработки
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadUrl(api.export1cPayrollCsv({ startDate, endDate }), '1c_payroll.csv')}>
              <Wallet size={16} />
              1C Расчёт
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Hourly Rate Modal ───────────────────────────────────────────────────

function HourlyRateModal({
  user,
  pending,
  onClose,
  onSubmit,
}: {
  user: User | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { hourlyRate: number }) => void;
}) {
  const [rate, setRate] = useState(0);

  useEffect(() => {
    if (user) {
      setRate(user.hourlyRate ?? 0);
    }
  }, [user]);

  return (
    <Modal
      open={!!user}
      title="Изменить почасовую ставку"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!user || rate < 0 || pending} onClick={() => onSubmit({ hourlyRate: rate })}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        {user && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{user.fullName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Текущая: {user.hourlyRate ?? 0} ₽/ч</p>
          </div>
        )}
        <Field label="Ставка (₽/ч)" type="number" min={0} value={rate} onChange={(event) => setRate(Number(event.target.value))} />
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
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
