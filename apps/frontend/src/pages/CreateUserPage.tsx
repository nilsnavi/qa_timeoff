import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronRight, Info, Mail, Shield, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorState, Field } from '../components/ui';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import type { Role, Team } from '../shared/types';
import { getRoleLabel } from '../shared/utils';
import { clsx } from 'clsx';

type Tab = 'general' | 'access' | 'additional';

const roles: Role[] = ['EMPLOYEE', 'LEAD', 'MANAGER', 'ADMIN'];
const roleDescriptions: Record<Role, string> = {
  EMPLOYEE: 'Доступ к своим заявкам, балансу и календарю',
  LEAD: 'Доступ к заявкам своей команды, согласование',
  MANAGER: 'Управление командой, отчёты, KPI',
  ADMIN: 'Полный доступ ко всем функциям системы',
};
const roleAccess: Record<Role, string[]> = {
  EMPLOYEE: ['Мои заявки', 'Баланс', 'Календарь'],
  LEAD: ['Мои заявки', 'Команда', 'Согласование', 'Календарь'],
  MANAGER: ['Мои заявки', 'Команда', 'Согласование', 'Аналитика', 'KPI'],
  ADMIN: ['Всё', 'Пользователи', 'Аудит', 'Аналитика', 'KPI', 'Экспорт'],
};

export function CreateUserPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('general');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [teamId, setTeamId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sendInvite, setSendInvite] = useState(false);

  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: isAdmin });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const teams = teamsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const selectedTeam = teams.find(t => t.id === teamId);
  const teamMembers = users.filter(u => u.teamId === teamId);

  const createMutation = useMutation({
    mutationFn: () => api.createUser({
      fullName, email: email || undefined, position: position || undefined,
      role, teamId: teamId || undefined, managerId: managerId || undefined,
      isActive, passwordHash: undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      navigate('/admin');
    },
  });

  if (!isAdmin) return <ErrorState title="Доступ запрещён" description="Только для администраторов" />;

  const isValid = fullName.trim().length > 0 && email.includes('@');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="grid h-9 w-9 place-items-center rounded-lg text-[#B8C0D0] hover:bg-white/[0.06] hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[13px] text-white/30">
              <span>Администрирование</span><ChevronRight size={12} />
              <span>Пользователи</span><ChevronRight size={12} />
              <span className="text-white/50">Новый пользователь</span>
            </div>
            <h1 className="text-[24px] font-bold text-white mt-0.5">Новый пользователь</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/admin')}>Отмена</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
            <UserPlus size={14} className="mr-1" />
            {createMutation.isPending ? 'Создание...' : 'Создать пользователя'}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main form area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1 w-fit">
            {([
              ['general', 'Основная информация'],
              ['access', 'Роль и доступы'],
              ['additional', 'Дополнительно'],
            ] as [Tab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={clsx('rounded-lg px-4 py-2 text-[14px] font-semibold transition-colors',
                  tab === key ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50')}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab: General */}
          {tab === 'general' && (
            <div className="enterprise-card p-6 space-y-6">
              <Section title="Личные данные">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Полное имя *" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" />
                  <Field label="Email *" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.ru" />
                </div>
              </Section>
              <Section title="Рабочая информация">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Должность" value={position} onChange={e => setPosition(e.target.value)} placeholder="QA Engineer" />
                  <div className="field-shell">
                    <span className="field-label">Команда</span>
                    <select value={teamId} onChange={e => setTeamId(e.target.value)} className="field-input">
                      <option value="">—</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="field-shell">
                    <span className="field-label">Руководитель</span>
                    <select value={managerId} onChange={e => setManagerId(e.target.value)} className="field-input">
                      <option value="">—</option>
                      {teamMembers.filter(u => u.role === 'MANAGER' || u.role === 'LEAD' || u.role === 'ADMIN').map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({getRoleLabel(u.role)})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* Tab: Access */}
          {tab === 'access' && (
            <div className="enterprise-card p-6 space-y-6">
              <Section title="Роль и права доступа">
                <div className="space-y-3">
                  {roles.map(r => (
                    <button key={r} onClick={() => setRole(r)}
                      className={clsx('w-full rounded-xl border p-4 text-left transition-all',
                        role === r ? 'border-[#4C7DFF]/30 bg-[#4C7DFF]/5' : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={clsx('grid h-10 w-10 place-items-center rounded-lg', role === r ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'bg-white/[0.04] text-white/30')}>
                            <Shield size={18} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-white">{getRoleLabel(r)}</p>
                            <p className="text-[12px] text-white/40 mt-0.5">{roleDescriptions[r]}</p>
                          </div>
                        </div>
                        {role === r && <Check size={18} className="text-[#4C7DFF]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Доступ к модулям">
                <div className="flex flex-wrap gap-2">
                  {roleAccess[role].map(mod => (
                    <span key={mod} className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white/50">
                      {mod}
                    </span>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Tab: Additional */}
          {tab === 'additional' && (
            <div className="enterprise-card p-6 space-y-6">
              <Section title="Статус пользователя">
                <div className="flex items-center gap-2">
                  {[true, false].map(active => (
                    <button key={String(active)} onClick={() => setIsActive(active)}
                      className={clsx('rounded-lg px-4 py-2 text-[14px] font-semibold transition-colors',
                        isActive === active ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]')}>
                      {active ? 'Активен' : 'Заблокирован'}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Приглашение">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={clsx('grid h-8 w-8 place-items-center rounded-lg border-2 transition-colors', sendInvite ? 'border-[#4C7DFF] bg-[#4C7DFF]/10 text-[#4C7DFF]' : 'border-white/[0.08] text-transparent')}>
                    {sendInvite && <Check size={14} />}
                  </div>
                  <div>
                    <span className="text-[14px] font-semibold text-white">Отправить приглашение</span>
                    <p className="text-[12px] text-white/30">Пользователь получит email с инструкцией по входу</p>
                  </div>
                  <input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} className="hidden" />
                </label>
              </Section>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="hidden w-72 shrink-0 space-y-4 lg:block">
          {/* Summary card */}
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-[#4C7DFF]" />
              <span className="text-[13px] font-bold text-white/60 uppercase">Действия</span>
            </div>
            <div className="space-y-1.5 text-[12px] text-white/40">
              <p>• Пользователь будет создан</p>
              <p>• Назначена роль: <b className="text-white/60">{getRoleLabel(role)}</b></p>
              <p>• {teamId ? `Добавлен в команду: ${selectedTeam?.name || '—'}` : 'Без команды'}</p>
              {sendInvite && <p>• Отправлено приглашение на email</p>}
              <p>• Запись в Audit Log</p>
            </div>
          </div>

          {/* Role info */}
          <div className="enterprise-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-amber-400" />
              <span className="text-[13px] font-bold text-white/60 uppercase">Роль: {getRoleLabel(role)}</span>
            </div>
            <p className="text-[12px] text-white/40">{roleDescriptions[role]}</p>
            <div className="flex flex-wrap gap-1">
              {roleAccess[role].map(mod => (
                <span key={mod} className="rounded-md bg-white/[0.03] px-2 py-1 text-[10px] text-white/30">{mod}</span>
              ))}
            </div>
          </div>

          {/* Team info */}
          {selectedTeam && (
            <div className="enterprise-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-emerald-400" />
                <span className="text-[13px] font-bold text-white/60 uppercase">Команда</span>
              </div>
              <p className="text-[14px] font-semibold text-white">{selectedTeam.name}</p>
              <p className="text-[12px] text-white/40">{teamMembers.length} сотрудников</p>
            </div>
          )}

          {/* Status badge */}
          <div className="enterprise-card p-4 space-y-2">
            <span className="text-[13px] font-bold text-white/60 uppercase block">Статус</span>
            <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold',
              isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-950/300/10 text-rose-400')}>
              <span className={clsx('h-2 w-2 rounded-full', isActive ? 'bg-emerald-400' : 'bg-rose-400')} />
              {isActive ? 'Активен' : 'Заблокирован'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-bold text-white/40 uppercase mb-3">{title}</p>
      {children}
    </div>
  );
}
