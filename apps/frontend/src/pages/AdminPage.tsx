import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Plus, Search, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, ErrorState, Field, Loader, Modal, Select } from '../components/ui';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import type { Role, Team, User } from '../shared/types';
import { getRoleLabel } from '../shared/utils';
import { DataTable, type Column, type SortDirection } from '../components/dashboard-v2/DataTable';
import { clsx } from 'clsx';

type AdminTab = 'users' | 'teams' | 'audit';

const roles: Role[] = ['EMPLOYEE', 'LEAD', 'MANAGER', 'ADMIN'];
const statusClasses: Record<string, string> = {
  true: 'bg-emerald-500/10 text-emerald-400',
  false: 'bg-rose-950/300/10 text-rose-400',
};

export function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('EMPLOYEE');
  const [newTeamId, setNewTeamId] = useState('');

  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats, enabled: isAdmin });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: isAdmin });
  const auditQuery = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api.auditLog(), enabled: isAdmin && activeTab === 'audit' });

  const stats = statsQuery.data;
  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const auditItems = auditQuery.data?.items ?? [];

  const filteredUsers = useMemo(() => {
    let result = users;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(u => u.fullName.toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s) || (u.position ?? '').toLowerCase().includes(s));
    }
    if (roleFilter !== 'ALL') result = result.filter(u => u.role === roleFilter);
    if (teamFilter !== 'ALL') result = result.filter(u => u.teamId === teamFilter);
    return result;
  }, [users, search, roleFilter, teamFilter]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filteredUsers;
    return [...filteredUsers].sort((a, b) => {
      const aVal = String((a as any)[sortKey] ?? '');
      const bVal = String((b as any)[sortKey] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredUsers, sortKey, sortDir]);

  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(p => p === 'asc' ? 'desc' : p === 'desc' ? null : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const disableMutation = useMutation({
    mutationFn: api.disableUser,
    onSuccess: () => { queryClient.invalidateQueries(); queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }); },
  });

  const handleDisable = (u: User) => {
    if (window.confirm(`Заблокировать ${u.fullName}?`)) disableMutation.mutate(u.id);
  };

  const handleCreate = () => {
    const dto: any = { fullName: newFullName, email: newEmail || undefined, role: newRole, teamId: newTeamId || undefined, passwordHash: undefined };
    api.createUser(dto).then(() => { queryClient.invalidateQueries(); queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }); setCreateOpen(false); setNewFullName(''); setNewEmail(''); }).catch(() => {});
  };

  if (!isAdmin) return <ErrorState title="Доступ запрещён" description="Только для администраторов" />;

  const columns: Column<User>[] = [
    { key: 'fullName', header: 'ФИО', width: '18%', sortable: true, render: (u) => <span className="font-semibold text-white/90">{u.fullName}</span> },
    { key: 'email', header: 'Email', width: '18%', render: (u) => <span className="text-white/50">{u.email || '—'}</span> },
    { key: 'role', header: 'Роль', width: '12%', sortable: true, render: (u) => <Badge tone={u.role === 'ADMIN' ? 'gradient' : 'default'}>{getRoleLabel(u.role)}</Badge> },
    { key: 'team', header: 'Команда', width: '12%', render: (u) => <span className="text-white/50">{(u as any).team?.name || '—'}</span> },
    { key: 'position', header: 'Должность', width: '15%', render: (u) => <span className="text-white/50">{u.position || '—'}</span> },
    { key: 'isActive', header: 'Статус', width: '10%', sortable: true, align: 'center', render: (u) => (
      <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase', statusClasses[String(u.isActive)])}>
        {u.isActive ? 'Активен' : 'Заблокирован'}
      </span>
    )},
    { key: 'actions', header: '', width: '10%', align: 'right', render: (u) => (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); }} className="!min-h-0 h-7 !px-2 text-[12px]">Роль</Button>
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
          <Button variant="secondary" size="sm"><FileSpreadsheet size={14} className="mr-1" />Импорт</Button>
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

      {/* Tabs + Main Content */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tab bar */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 w-fit">
            {(['users', 'teams', 'audit'] as AdminTab[]).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
                className={clsx('rounded-lg px-4 py-2 text-[14px] font-semibold transition-colors',
                  activeTab === tab ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50')}>
                {tab === 'users' ? 'Пользователи' : tab === 'teams' ? 'Команды' : 'Аудит'}
              </button>
            ))}
          </div>

          {/* Search + Filters */}
          {activeTab === 'users' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Поиск..." className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-[15px] text-white placeholder:text-white/20 outline-none" />
              </div>
              <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/60 outline-none">
                <option value="ALL">Все роли</option>
                {roles.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
              </select>
              <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setPage(1); }} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/60 outline-none">
                <option value="ALL">Все команды</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Content */}
          {activeTab === 'users' && (
            <DataTable columns={columns} data={paginated} keyField="id" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
              page={page} total={sorted.length} pageSize={pageSize} onPageChange={setPage} emptyMessage="Нет пользователей" />
          )}
          {activeTab === 'teams' && (
            <div className="space-y-3">
              {teams.map(t => (
                <div key={t.id} className="enterprise-card p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-semibold text-white">{t.name}</span>
                    <span className="text-[13px] text-white/30 ml-3">{(t as any).users?.length ?? 0} сотрудников</span>
                  </div>
                  <span className="text-[13px] text-white/30">{t.description || ''}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'audit' && (
            <div className="space-y-2">
              {auditItems.map((item: any) => (
                <div key={item.id} className="enterprise-card p-3 flex items-center gap-3">
                  <span className="text-[12px] font-bold text-white/30 uppercase w-28">{item.action}</span>
                  <span className="text-[13px] text-white/60">{item.actor?.fullName || 'Система'}</span>
                  <span className="text-[12px] text-white/20 ml-auto">{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
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

      {/* Create User Modal */}
      {createOpen && (
        <Modal open title="Новый пользователь" onClose={() => setCreateOpen(false)}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button><Button onClick={handleCreate}>Создать</Button></div>}>
          <div className="space-y-4">
            <Field label="ФИО" value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Иван Иванов" />
            <Field label="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@company.ru" />
            <Select label="Роль" value={newRole} onChange={e => setNewRole(e.target.value as Role)} options={roles.map(r => ({ value: r, label: getRoleLabel(r) }))} />
            <Select label="Команда" value={newTeamId} onChange={e => setNewTeamId(e.target.value)} options={[{ value: '', label: '—' }, ...teams.map(t => ({ value: t.id, label: t.name }))]} />
          </div>
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
