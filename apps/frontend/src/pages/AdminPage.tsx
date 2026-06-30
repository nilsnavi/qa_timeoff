import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Copy, Download, Edit3, FileSpreadsheet, KeyRound, Plus, Search, ShieldAlert, Trash2, UserPlus, Wallet, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, CustomSelect, ErrorState, Field, Loader, Modal } from '../components/ui';
import type { SelectOption } from '../components/ui/CustomSelect';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import type { ImportUserResult, PositionHistory, Role, Team, User } from '../shared/types';
import { getRoleLabel, showAppToast } from '../shared/utils';
import { DataTable, type Column, type SortDirection } from '../components/dashboard-v2/DataTable';
import { clsx } from 'clsx';
import { KpiTab } from './admin-tabs/KpiTab';
import { OvertimeTab } from './admin-tabs/OvertimeTab';
import { ExportTab } from './admin-tabs/ExportTab';
import { AiForecastTab } from './admin-tabs/AiForecastTab';

type AdminTab = 'users' | 'teams' | 'kpi' | 'overtime' | 'analytics' | 'export' | 'ai';

const roles: Role[] = ['EMPLOYEE', 'LEAD', 'MANAGER', 'ADMIN'];

const allRoleOptions: SelectOption[] = [
  { value: 'ALL', label: 'Все роли' },
  ...roles.map(r => ({ value: r, label: getRoleLabel(r) })),
];

const roleOptions: SelectOption[] = roles.map(r => ({ value: r, label: getRoleLabel(r) }));

export function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [createOpen, setCreateOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('EMPLOYEE');
  const [newTeamId, setNewTeamId] = useState('');

  // ── Team management ────────────────────────────────────────────────
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');

  const createTeamMutation = useMutation({
    mutationFn: () => api.createTeam({ name: teamName, description: teamDescription || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); closeTeamModal(); },
  });

  const updateTeamMutation = useMutation({
    mutationFn: () => api.updateTeam(editingTeam!.id, { name: teamName, description: teamDescription || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); closeTeamModal(); },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => api.deleteTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  const openCreateTeam = () => { setEditingTeam(null); setTeamName(''); setTeamDescription(''); setTeamModalOpen(true); };
  const openEditTeam = (t: Team) => { setEditingTeam(t); setTeamName(t.name); setTeamDescription(t.description ?? ''); setTeamModalOpen(true); };
  const closeTeamModal = () => { setTeamModalOpen(false); setEditingTeam(null); setTeamName(''); setTeamDescription(''); };

  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats, enabled: isAdmin });
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', search, roleFilter, teamFilter],
    queryFn: () => api.adminUsers({ search: search || undefined, role: roleFilter !== 'ALL' ? roleFilter : undefined, teamId: teamFilter !== 'ALL' ? teamFilter : undefined }),
    enabled: isAdmin,
  });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: isAdmin });

  const stats = statsQuery.data;
  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  const teamOptions: SelectOption[] = [
    { value: 'ALL', label: 'Все команды' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  const teamOptionsWithEmpty: SelectOption[] = [
    { value: '', label: '—' },
    ...teams.map(t => ({ value: t.id, label: t.name })),
  ];

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return users;
    return [...users].sort((a, b) => {
      const aVal = String((a as any)[sortKey] ?? '');
      const bVal = String((b as any)[sortKey] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(p => p === 'asc' ? 'desc' : p === 'desc' ? null : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const disableMutation = useMutation({
    mutationFn: (id: string) => api.disableUser(id),
    onSuccess: () => { queryClient.invalidateQueries(); queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }); },
  });

  const handleDisable = (u: User) => {
    if (window.confirm(`Заблокировать ${u.fullName}?`)) disableMutation.mutate(u.id);
  };

  // ── User editing ──────────────────────────────────────────────────
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>('EMPLOYEE');
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editPermCodes, setEditPermCodes] = useState<string[]>([]);
  const [editTeamId, setEditTeamId] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState(0);

  const rolesListQuery = useQuery({ queryKey: ['roles'], queryFn: () => api.roles(), enabled: isAdmin });
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: () => api.permissions(), enabled: isAdmin });
  const allRoles = rolesListQuery.data ?? [];
  const allPermissions = permissionsQuery.data ?? [];

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      await api.updateUser(editingUser!.id, {
        fullName: editFullName, email: editEmail || undefined,
        role: editRole, roleId: editRoleId, teamId: editTeamId || undefined,
      });
      if (editRoleId && editPermCodes.length > 0) {
        await api.updateRolePermissions(editRoleId, editPermCodes);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries(); queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }); queryClient.invalidateQueries({ queryKey: ['roles'] }); setEditUserOpen(false); },
  });

  const updatePositionMutation = useMutation({
    mutationFn: () => api.updatePosition(editingUser!.id, editPosition),
    onSuccess: () => { queryClient.invalidateQueries(); },
  });

  const updateHourlyRateMutation = useMutation({
    mutationFn: () => api.updateHourlyRate(editingUser!.id, editHourlyRate),
    onSuccess: () => { queryClient.invalidateQueries(); },
  });

  const userOpsQuery = useQuery({
    queryKey: ['admin', 'user-operations', editingUser?.id],
    queryFn: () => api.userOperations(editingUser!.id),
    enabled: !!editingUser,
  });

  const positionHistoryQuery = useQuery({
    queryKey: ['admin', 'position-history', editingUser?.id],
    queryFn: () => api.positionHistory(editingUser!.id),
    enabled: !!editingUser,
  });

  const positionHistory = positionHistoryQuery.data ?? [];

  const openEditUser = (u: any) => {
    setEditingUser(u);
    setEditFullName(u.fullName);
    setEditEmail(u.email ?? '');
    setEditRole(u.role);
    const foundRole = allRoles.find((r: any) => r.code === u.role);
    setEditRoleId(foundRole?.id ?? null);
    setEditPermCodes(foundRole?.permissions?.map((rp: any) => rp.permission.code) ?? []);
    setEditTeamId(u.teamId ?? '');
    setEditPosition(u.position ?? '');
    setEditHourlyRate(u.hourlyRate ?? 0);
    setEditUserOpen(true);
  };

  // ── Balance management ────────────────────────────────────────────
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceUserId, setBalanceUserId] = useState('');
  const [balanceUserName, setBalanceUserName] = useState('');
  const [balanceHours, setBalanceHours] = useState(0);
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceMode, setBalanceMode] = useState<'add' | 'write-off'>('add');

  const addBalanceMutation = useMutation({
    mutationFn: () => api.addBalance({ userId: balanceUserId, hours: balanceHours, reason: balanceReason }),
    onSuccess: () => { queryClient.invalidateQueries(); closeBalanceModal(); },
  });

  const writeOffBalanceMutation = useMutation({
    mutationFn: () => api.writeOffBalance({ userId: balanceUserId, hours: balanceHours, reason: balanceReason }),
    onSuccess: () => { queryClient.invalidateQueries(); closeBalanceModal(); },
  });

  const openBalanceModal = (u: User, mode: 'add' | 'write-off') => {
    setBalanceUserId(u.id);
    setBalanceUserName(u.fullName);
    setBalanceMode(mode);
    setBalanceHours(0);
    setBalanceReason('');
    setBalanceModalOpen(true);
  };

  const closeBalanceModal = () => { setBalanceModalOpen(false); setBalanceUserId(''); setBalanceUserName(''); setBalanceHours(0); setBalanceReason(''); };

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [importResults, setImportResults] = useState<ImportUserResult[] | null>(null);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'result'>('select');

  const importMutation = useMutation({
    mutationFn: (file: File) => api.importUsers(file),
    onSuccess: (data) => {
      setImportResults(data);
      setImportStep('result');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const created = data.filter(r => r.status === 'created').length;
      if (created > 0) showAppToast(`Импортировано ${created} пользователей`);
    },
    onError: (err: any) => showAppToast(err.message ?? 'Ошибка импорта', undefined, 'error'),
  });

  function parsePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text
        .split('\n')
        .slice(0, 6)
        .map(row => row.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      setImportPreview(rows);
      setImportStep('preview');
    };
    reader.readAsText(file, 'utf-8');
  }

  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => api.resetUserPassword(userId),
    onSuccess: (data) => setResetPassword(data.tempPassword),
    onError: () => showAppToast('Не удалось сбросить пароль', undefined, 'error'),
  });

  const handleCreate = () => {
    api.createUser({ fullName: newFullName, email: newEmail || undefined, role: newRole, teamId: newTeamId || undefined })
      .then(() => { queryClient.invalidateQueries(); queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }); setCreateOpen(false); setNewFullName(''); setNewEmail(''); })
      .catch(() => {});
  };

  if (!isAdmin) return <ErrorState title="Доступ запрещён" description="Только для администраторов" />;

  const columns: Column<any>[] = [
    { key: 'fullName', header: 'ФИО', width: '18%', sortable: true, render: (u) => <span className="font-semibold text-white/90">{u.fullName}</span> },
    { key: 'email', header: 'Email', width: '18%', render: (u) => <span className="text-white/50">{u.email || '—'}</span> },
    { key: 'role', header: 'Роль', width: '12%', sortable: true, render: (u) => <Badge tone="neutral">{getRoleLabel(u.role)}</Badge> },
    { key: 'team', header: 'Команда', width: '12%', render: (u) => <span className="text-white/50">{u.team?.name || '—'}</span> },
    { key: 'position', header: 'Должность', width: '15%', render: (u) => <span className="text-white/50">{u.position || '—'}</span> },
    { key: 'isActive', header: 'Статус', width: '10%', sortable: true, align: 'center', render: (u) => (
      <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase', u.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-950/300/10 text-rose-400')}>
        {u.isActive ? 'Активен' : 'Заблокирован'}
      </span>
    )},
    { key: 'actions', header: '', width: '15%', align: 'right', render: (u) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditUser(u); }} className="!min-h-0 h-7 w-7 !p-0 text-white/40 hover:text-white">
          <Edit3 size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openBalanceModal(u, 'add'); }} className="!min-h-0 h-7 w-7 !p-0 text-emerald-400">
          <Wallet size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openBalanceModal(u, 'write-off'); }} className="!min-h-0 h-7 w-7 !p-0 text-amber-400">
          <Minus size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setResetTarget(u); setResetPassword(null); }} className="!min-h-0 h-7 w-7 !p-0 text-white/25 hover:text-amber-400" title="Сбросить пароль">
          <KeyRound size={13} />
        </Button>
        {u.isActive && (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDisable(u); }} className="!min-h-0 h-7 w-7 !p-0 text-rose-400">
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Администрирование</h1>
          <p className="text-[15px] text-white/40 mt-1">Управление пользователями, командами и аудит системы</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm"><Download size={14} className="mr-1" />Экспорт</Button>
          <Button variant="secondary" size="sm" onClick={() => { setImportStep('select'); setImportFile(null); setImportPreview([]); setImportResults(null); setImportOpen(true); }}><FileSpreadsheet size={14} className="mr-1" />Импорт</Button>
          <Button onClick={() => setCreateOpen(true)}><UserPlus size={14} className="mr-1" />Добавить</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Всего" value={stats?.totalUsers ?? 0} icon={ShieldAlert} color="blue" />
        <KpiCard label="Активных" value={stats?.activeUsers ?? 0} icon={UserPlus} color="emerald" />
        <KpiCard label="За месяц" value={stats?.newUsersThisMonth ?? 0} icon={Plus} color="violet" />
        <KpiCard label="Заблокированных" value={stats?.blockedUsers ?? 0} icon={Trash2} color="rose" />
        <KpiCard label="Команд" value={stats?.teamsCount ?? 0} icon={Search} color="amber" />
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 w-fit flex-wrap">
            {(['users', 'teams', 'kpi', 'overtime', 'analytics', 'ai', 'export'] as AdminTab[]).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
                className={clsx('rounded-lg px-4 py-2 text-[14px] font-semibold transition-colors',
                  activeTab === tab ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50')}>
                {tab === 'users' ? 'Пользователи' : tab === 'teams' ? 'Команды' : tab === 'kpi' ? 'KPI' : tab === 'overtime' ? 'Овертайм' : tab === 'analytics' ? 'Аналитика' : tab === 'ai' ? 'AI' : 'Экспорт'}
              </button>
            ))}
          </div>

          {activeTab === 'users' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Поиск..." className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-[15px] text-white placeholder:text-white/20 outline-none" />
              </div>
              <CustomSelect
                value={roleFilter}
                onChange={v => { setRoleFilter(v); setPage(1); }}
                options={allRoleOptions}
                placeholder="Все роли"
                small
                className="w-36"
              />
              <CustomSelect
                value={teamFilter}
                onChange={v => { setTeamFilter(v); setPage(1); }}
                options={teamOptions}
                placeholder="Все команды"
                small
                className="w-40"
              />
            </div>
          )}

          {activeTab === 'users' && (
            <DataTable columns={columns} data={paginated as any} keyField="id" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
              page={page} total={sorted.length} pageSize={pageSize} onPageChange={setPage} emptyMessage="Нет пользователей" />
          )}
          {activeTab === 'teams' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-white/40 uppercase">Команды ({teams.length})</span>
                <Button size="sm" variant="secondary" onClick={openCreateTeam}><Plus size={14} className="mr-1" />Добавить</Button>
              </div>
              {teams.map(t => (
                <div key={t.id} className="enterprise-card p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-semibold text-white">{t.name}</span>
                    <span className="text-[13px] text-white/30 ml-3">{(t as any).users?.length ?? 0} сотрудников</span>
                    {t.description && <p className="text-[13px] text-white/30 mt-1">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditTeam(t)} className="!min-h-0 h-7 w-7 !p-0 text-white/40 hover:text-white">
                      <Edit3 size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Удалить команду «${t.name}»?`)) deleteTeamMutation.mutate(t.id); }} className="!min-h-0 h-7 w-7 !p-0 text-rose-400">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'ai' && <AiForecastTab />}
          {activeTab === 'kpi' && <KpiTab />}
          {activeTab === 'overtime' && <OvertimeTab />}
          {activeTab === 'analytics' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <BarChart3 size={48} className="text-white/20" />
              <p className="text-[15px] text-white/40">Полноценная страница аналитики с графиками</p>
              <Button onClick={() => navigate('/analytics')}>
                Открыть аналитику
              </Button>
            </div>
          )}
          {activeTab === 'export' && <ExportTab />}
        </div>

        <div className="hidden w-56 shrink-0 space-y-4 lg:block">
          <div className="enterprise-card p-4 space-y-3">
            <p className="text-[13px] font-bold text-white/40 uppercase">Действия</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => setCreateOpen(true)}><UserPlus size={14} />Создать</Button>
            <Button size="sm" variant="secondary" className="w-full"><Download size={14} />Экспорт</Button>
          </div>
          {stats?.byRole && (
            <div className="enterprise-card p-4 space-y-2">
              <p className="text-[13px] font-bold text-white/40 uppercase">По ролям</p>
              {stats.byRole.map(r => (
                <div key={r.role} className="flex justify-between text-[13px]">
                  <span className="text-white/50">{getRoleLabel(r.role as Role)}</span>
                  <span className="font-semibold text-white">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <Modal open title="Новый пользователь" onClose={() => setCreateOpen(false)}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button><Button onClick={handleCreate}>Создать</Button></div>}>
          <div className="space-y-4">
            <Field label="ФИО" value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Иван Иванов" />
            <Field label="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@company.ru" />
            <div className="field-shell">
              <span className="field-label">Роль</span>
              <CustomSelect
                value={newRole}
                onChange={v => setNewRole(v as Role)}
                options={roleOptions}
              />
            </div>
            <div className="field-shell">
              <span className="field-label">Команда</span>
              <CustomSelect
                value={newTeamId}
                onChange={setNewTeamId}
                options={teamOptionsWithEmpty}
                placeholder="—"
              />
            </div>
          </div>
        </Modal>
      )}

      {teamModalOpen && (
        <Modal open title={editingTeam ? 'Редактировать команду' : 'Новая команда'} onClose={closeTeamModal}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={closeTeamModal}>Отмена</Button><Button onClick={() => editingTeam ? updateTeamMutation.mutate() : createTeamMutation.mutate()} disabled={createTeamMutation.isPending || updateTeamMutation.isPending}>{editingTeam ? 'Сохранить' : 'Создать'}</Button></div>}>
          <div className="space-y-4">
            <Field label="Название" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Название команды" />
            <Field label="Описание" value={teamDescription} onChange={e => setTeamDescription(e.target.value)} placeholder="Описание (необязательно)" />
          </div>
        </Modal>
      )}

      {editUserOpen && editingUser && (
        <Modal open title={`Редактировать: ${editingUser.fullName}`} onClose={() => setEditUserOpen(false)}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={() => setEditUserOpen(false)}>Отмена</Button><Button onClick={() => updateUserMutation.mutate()} disabled={updateUserMutation.isPending}>Сохранить</Button></div>}>
          <div className="space-y-4">
            <Field label="ФИО" value={editFullName} onChange={e => setEditFullName(e.target.value)} />
            <Field label="Email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            <div className="field-shell">
              <span className="field-label">Роль</span>
              <CustomSelect
                value={editRole}
                onChange={v => {
                  setEditRole(v as Role);
                  const found = allRoles.find((r: any) => r.code === v);
                  setEditRoleId(found?.id ?? null);
                  setEditPermCodes(found?.permissions?.map((rp: any) => rp.permission.code) ?? []);
                }}
                options={roleOptions}
              />
            </div>
            {allPermissions.length > 0 && (
              <div className="border-t border-white/[0.06] pt-4 space-y-2">
                <span className="text-[12px] font-bold text-white/40 uppercase block">Права доступа роли «{getRoleLabel(editRole)}»</span>
                <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                  {allPermissions.map((p: any) => (
                    <label key={p.code} className="flex items-center gap-2 cursor-pointer hover:bg-white/[0.04] rounded px-1 py-1">
                      <input
                        type="checkbox"
                        checked={editPermCodes.includes(p.code)}
                        onChange={() => setEditPermCodes(prev => prev.includes(p.code) ? prev.filter(c => c !== p.code) : [...prev, p.code])}
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-[#4C7DFF]"
                      />
                      <span className="text-[12px] text-white/60">{p.name}</span>
                      <span className="text-[11px] text-white/20 ml-auto">{p.groupName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="field-shell">
              <span className="field-label">Команда</span>
              <CustomSelect
                value={editTeamId}
                onChange={setEditTeamId}
                options={teamOptionsWithEmpty}
                placeholder="—"
              />
            </div>
            <div className="border-t border-white/[0.06] pt-4 space-y-4">
              <span className="text-[12px] font-bold text-white/40 uppercase">Должность и ставка</span>
              <Field label="Должность" value={editPosition} onChange={e => setEditPosition(e.target.value)} placeholder="Должность" />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Часовая ставка" type="number" value={String(editHourlyRate)} onChange={e => setEditHourlyRate(Number(e.target.value))} />
                </div>
                <Button size="sm" variant="secondary" onClick={() => updatePositionMutation.mutate()} disabled={updatePositionMutation.isPending}>
                  Обновить должность
                </Button>
                <Button size="sm" variant="secondary" onClick={() => updateHourlyRateMutation.mutate()} disabled={updateHourlyRateMutation.isPending}>
                  Обновить ставку
                </Button>
              </div>
              {positionHistory.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-white/30 uppercase block mb-1">История должностей</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {positionHistory.map((h: PositionHistory) => (
                      <div key={h.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-white/70">{h.position}</span>
                        <span className="text-white/30">{new Date(h.changedAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <span className="text-[12px] font-bold text-white/40 uppercase mb-2 block">История операций с балансом</span>
              {userOpsQuery.isLoading && <Loader />}
              {userOpsQuery.data && userOpsQuery.data.length === 0 && (
                <span className="text-[13px] text-white/30">Нет операций</span>
              )}
              {userOpsQuery.data && userOpsQuery.data.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {userOpsQuery.data.slice(0, 20).map((op: any) => (
                    <div key={op.id} className="flex items-center justify-between text-[13px]">
                      <span className={clsx('font-semibold', op.operationType === 'ADD' ? 'text-emerald-400' : 'text-rose-400')}>
                        {op.operationType === 'ADD' ? '+' : ''}{op.hours} ч
                      </span>
                      <span className="text-white/50 flex-1 ml-2">{op.reason}</span>
                      <span className="text-white/30 text-[12px]">{new Date(op.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {balanceModalOpen && (
        <Modal open title={`${balanceMode === 'add' ? 'Начислить' : 'Списать'} часы: ${balanceUserName}`} onClose={closeBalanceModal}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={closeBalanceModal}>Отмена</Button><Button onClick={() => (balanceMode === 'add' ? addBalanceMutation : writeOffBalanceMutation).mutate()} disabled={addBalanceMutation.isPending || writeOffBalanceMutation.isPending}>{balanceMode === 'add' ? 'Начислить' : 'Списать'}</Button></div>}>
          <div className="space-y-4">
            <Field label="Часы" type="number" value={String(balanceHours)} onChange={e => setBalanceHours(Number(e.target.value))} placeholder="0" />
            <Field label="Причина" value={balanceReason} onChange={e => setBalanceReason(e.target.value)} placeholder="Причина операции" />
          </div>
        </Modal>
      )}
      {resetTarget && (
        <Modal open title={resetPassword ? 'Пароль сброшен' : `Сбросить пароль: ${resetTarget.fullName}`}
          onClose={() => { setResetTarget(null); setResetPassword(null); }}
          footer={resetPassword ? (
            <Button onClick={() => { setResetTarget(null); setResetPassword(null); }}>Готово</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setResetTarget(null)}>Отмена</Button>
              <Button variant="danger" disabled={resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate(resetTarget.id)}>
                {resetPasswordMutation.isPending ? 'Сбрасываем...' : 'Сбросить пароль'}
              </Button>
            </div>
          )}
        >
          {!resetPassword ? (
            <div className="space-y-3">
              <p className="text-[14px] text-white/60">Будет сгенерирован новый временный пароль. {resetTarget.email ? `Письмо отправится на ${resetTarget.email}.` : 'У пользователя нет email — передайте пароль вручную.'}</p>
              <p className="text-[13px] text-white/40">При следующем входе пользователь будет обязан сменить пароль.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[14px] text-white/60">Новый временный пароль для <b className="text-white">{resetTarget.fullName}</b>:</p>
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
                <code className="flex-1 text-[20px] font-bold tracking-[0.15em] text-[#4C7DFF]">{resetPassword}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(resetPassword); showAppToast('Скопировано'); }}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/80">
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-[12px] text-white/30">{resetTarget.email ? 'Письмо уже отправлено на email пользователя.' : 'Передайте пароль пользователю лично — email не задан.'}</p>
            </div>
          )}
        </Modal>
      )}

      {importOpen && (
        <Modal
          open
          title={importStep === 'select' ? 'Импорт пользователей' : importStep === 'preview' ? 'Предпросмотр' : 'Результат импорта'}
          onClose={() => setImportOpen(false)}
          footer={
            importStep === 'select' ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setImportOpen(false)}>Отмена</Button>
                <Button disabled={!importFile} onClick={() => importFile && parsePreview(importFile)}>
                  Далее
                </Button>
              </div>
            ) : importStep === 'preview' ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setImportStep('select')}>Назад</Button>
                <Button
                  disabled={importMutation.isPending}
                  onClick={() => importFile && importMutation.mutate(importFile)}
                >
                  {importMutation.isPending ? 'Импортируем...' : `Импортировать ${importPreview.length - 1} строк`}
                </Button>
              </div>
            ) : (
              <Button onClick={() => setImportOpen(false)}>Закрыть</Button>
            )
          }
        >
          {importStep === 'select' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
                <FileSpreadsheet size={32} className="mx-auto mb-3 text-white/25" />
                <p className="text-[14px] font-medium text-white/60 mb-3">
                  Выберите CSV-файл
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  id="csv-upload"
                  onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl
                             bg-[#4C7DFF]/15 border border-[#4C7DFF]/25
                             px-4 py-2.5 text-[14px] font-semibold text-[#6B96FF]
                             hover:bg-[#4C7DFF]/25 transition-colors"
                >
                  <FileSpreadsheet size={15} />
                  {importFile ? importFile.name : 'Выбрать файл'}
                </label>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4 space-y-1.5">
                <p className="text-[13px] font-semibold text-white/60">Формат CSV (разделитель — запятая):</p>
                <code className="block text-[12px] text-[#4C7DFF]/80 bg-white/[0.03] rounded-lg px-3 py-2">
                  fullName,email,role,teamName,position
                </code>
                <p className="text-[12px] text-white/35">
                  role: ADMIN / MANAGER / LEAD / EMPLOYEE (или на русском)<br/>
                  teamName и position — необязательны
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const csv = 'fullName,email,role,teamName,position\nИванов Иван,ivanov@company.ru,EMPLOYEE,QA-команда,Тестировщик';
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'import_template.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[13px] text-[#4C7DFF] hover:text-[#6B96FF] transition-colors"
                >
                  Скачать шаблон →
                </button>
              </div>
            </div>
          )}

          {importStep === 'preview' && importPreview.length > 0 && (
            <div className="space-y-3">
              <p className="text-[13px] text-white/50">
                Первые {importPreview.length - 1} строк (не считая заголовка):
              </p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                      {importPreview[0]?.map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left text-[12px] font-semibold text-white/45">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(1).map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 text-white/70">{cell || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importStep === 'result' && importResults && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {(['created' as const, 'skipped' as const, 'error' as const]).map((key) => {
                  const cfg = key === 'created' ? { label: 'Создано', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
                    : key === 'skipped' ? { label: 'Пропущено', color: 'text-amber-400', bg: 'bg-amber-500/10' }
                    : { label: 'Ошибки', color: 'text-rose-400', bg: 'bg-rose-500/10' };
                  return (
                    <div key={key} className={`rounded-xl ${cfg.bg} p-3 text-center`}>
                      <p className={`text-[22px] font-bold ${cfg.color}`}>
                        {importResults.filter(r => r.status === key).length}
                      </p>
                      <p className="text-[12px] text-white/40">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="max-h-[280px] overflow-y-auto space-y-1.5">
                {importResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      r.status === 'created' ? 'bg-emerald-500/8'
                      : r.status === 'skipped' ? 'bg-amber-500/8'
                      : 'bg-rose-500/8'
                    }`}
                  >
                    <div className={`h-2 w-2 shrink-0 rounded-full ${
                      r.status === 'created' ? 'bg-emerald-500'
                      : r.status === 'skipped' ? 'bg-amber-500'
                      : 'bg-rose-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white/80 truncate">{r.fullName}</p>
                      <p className="text-[12px] text-white/40">{r.email}</p>
                      {r.reason && <p className="text-[12px] text-white/30 italic">{r.reason}</p>}
                    </div>
                    {r.status === 'created' && r.tempPassword && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <code className="text-[13px] font-bold tracking-widest text-[#4C7DFF]">
                          {r.tempPassword}
                        </code>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(r.tempPassword!); showAppToast('Скопировано'); }}
                          className="text-white/30 hover:text-white/60 transition-colors"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {importResults.some(r => r.status === 'created') && (
                <button
                  type="button"
                  onClick={() => {
                    const csv = [
                      'fullName,email,tempPassword,status',
                      ...importResults
                        .filter(r => r.status === 'created')
                        .map(r => `"${r.fullName}","${r.email}","${r.tempPassword}","${r.status}"`),
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'import_result.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl
                             bg-white/[0.04] border border-white/[0.07]
                             px-4 py-2.5 text-[14px] font-semibold text-white/60
                             hover:bg-white/[0.08] transition-colors"
                >
                  <Download size={15} />
                  Скачать результаты с паролями
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-400', emerald: 'bg-emerald-500/10 text-emerald-400', violet: 'bg-violet-500/10 text-violet-400', rose: 'bg-rose-950/300/10 text-rose-400', amber: 'bg-amber-500/10 text-amber-400' };
  return (
    <div className="enterprise-card p-4 hover-lift">
      <div className="flex items-center gap-2 mb-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${colors[color]}`}><Icon size={14} /></div>
        <span className="text-[13px] font-semibold text-white/40">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}
