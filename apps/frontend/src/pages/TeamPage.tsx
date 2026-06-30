import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CustomSelect, EmptyState, ErrorState, Loader } from '../components/ui';
import type { SelectOption } from '../components/ui/CustomSelect';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import type { User } from '../shared/types';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function getStatusLabel(user: User): { label: string; color: string } {
  if (!user.isActive) return { label: 'Заблокирован', color: 'bg-rose-500/10 text-rose-400' };
  return { label: 'Доступен', color: 'bg-emerald-500/10 text-emerald-400' };
}

export function TeamPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canView = user ? ['LEAD', 'MANAGER', 'ADMIN'].includes(user.role) : false;
  const [teamFilter, setTeamFilter] = useState('');

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: canView });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: canView });

  const allUsers = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  const teamOptions: SelectOption[] = [
    { value: '', label: 'Все команды' },
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ];

  const visibleUsers = useMemo(() => {
    let result = allUsers.filter((u: User) => u.isActive);
    if (user && user.role === 'LEAD' && user.teamId) {
      result = result.filter((u: User) => u.teamId === user.teamId);
    } else if (teamFilter) {
      result = result.filter((u: User) => u.teamId === teamFilter);
    }
    return result;
  }, [allUsers, user, teamFilter]);

  if (!canView || !user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Команда</h1>
          <p className="text-[15px] text-white/40 mt-1">
            Сотрудники{teamFilter ? ` — ${teams.find((t) => t.id === teamFilter)?.name ?? ''}` : ''}
          </p>
        </div>
        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <CustomSelect
              value={teamFilter}
              onChange={setTeamFilter}
              options={teamOptions}
              placeholder="Все команды"
            />
          </div>
        )}
      </div>

      {usersQuery.isLoading && <Loader />}
      {usersQuery.isError && <ErrorState title="Ошибка загрузки" description="Не удалось загрузить список сотрудников" />}

      {visibleUsers.length === 0 && !usersQuery.isLoading && !usersQuery.isError && (
        <EmptyState title="Нет сотрудников" description="В команде пока нет участников" />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleUsers.map((u) => {
          const status = getStatusLabel(u);
          return (
            <Card key={u.id}>
              <div className="flex items-start gap-3 mb-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#4C7DFF]/20 text-[14px] font-bold text-[#4C7DFF]">
                  {getInitials(u.fullName) || <UserRound size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-white truncate">{u.fullName}</p>
                  <p className="text-[12px] text-white/40">{u.position || 'Должность не указана'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge tone={u.role === 'ADMIN' ? 'danger' : u.role === 'MANAGER' ? 'info' : u.role === 'LEAD' ? 'warning' : 'neutral'}>
                  {u.role === 'ADMIN' ? 'Админ' : u.role === 'MANAGER' ? 'Менеджер' : u.role === 'LEAD' ? 'Лид' : 'Сотрудник'}
                </Badge>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.color}`}>
                  {status.label}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white/50">Баланс</span>
                <span className="font-semibold text-white/80">{u.timeBalance?.balanceHours ?? 0} ч</span>
              </div>

              <Button size="sm" className="w-full mt-3" variant="secondary" onClick={() => navigate(`/requests/manager?userId=${u.id}`)}>
                Заявки
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
