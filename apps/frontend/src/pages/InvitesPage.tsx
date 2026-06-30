import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Link, X, Mail } from 'lucide-react';
import { useState } from 'react';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { Card, Button, Input, Badge } from '../components/ui';
import { showAppToast } from '../shared/utils';
import type { Invite } from '../shared/types';

const statusColors: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидает',
  ACCEPTED: 'Принято',
  EXPIRED: 'Истекло',
  CANCELLED: 'Отменено',
};

export function InvitesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');

  const { data: invites } = useQuery({ queryKey: ['invites'], queryFn: api.invites });
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: api.teams });
  const [selectedTeam, setSelectedTeam] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.createInvite({ email, role, teamId: selectedTeam || undefined }),
    onSuccess: (data: Invite) => {
      showAppToast('Приглашение создано', undefined, 'success');
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      const link = (data as any).link;
      if (link) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
    },
    onError: (err: any) => showAppToast('Ошибка', err?.message ?? 'Не удалось создать приглашение', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      showAppToast('Приглашение отменено', undefined, 'success');
    },
  });

  const copyLink = (link?: string) => {
    if (link) {
      navigator.clipboard.writeText(link);
      showAppToast('Ссылка скопирована', undefined, 'success');
    }
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return <div className="rounded-xl bg-white/[0.03] p-6 text-center text-white/40">Нет доступа</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Приглашения</h1>
        <p className="text-[15px] text-white/40 mt-1">Приглашайте новых сотрудников в организацию</p>
      </div>

      <Card>
        <div className="flex items-end gap-2 flex-wrap">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.ru" className="min-w-[200px]" />
          <div className="field-shell">
            <span className="field-label">Роль</span>
            <select value={role} onChange={e => setRole(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[14px] text-white outline-none min-w-[120px]">
              <option value="EMPLOYEE">Сотрудник</option>
              <option value="LEAD">Лид</option>
              <option value="MANAGER">Менеджер</option>
              <option value="ADMIN">Админ</option>
            </select>
          </div>
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[14px] text-white outline-none min-w-[140px]">
              <option value="">Без команды</option>
              {(teams ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!email || createMutation.isPending} className="shrink-0">
            <UserPlus size={16} /> Пригласить
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {(invites ?? []).length === 0 && (
          <div className="rounded-xl bg-white/[0.02] p-8 text-center">
            <Mail size={32} className="mx-auto text-white/20 mb-2" />
            <p className="text-[14px] text-white/40">Нет приглашений</p>
          </div>
        )}
        {(invites ?? []).map((inv: Invite) => (
          <div key={inv.id} className="enterprise-card flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-white/80 truncate">{inv.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge tone={statusColors[inv.status] ?? 'neutral'}>{statusLabels[inv.status] ?? inv.status}</Badge>
                <span className="text-[12px] text-white/30">{inv.role}</span>
                {inv.team && <span className="text-[12px] text-white/30">· {inv.team.name}</span>}
                <span className="text-[12px] text-white/30">· {inv.invitedBy?.fullName ?? '—'}</span>
              </div>
            </div>
            {inv.status === 'PENDING' && (
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => copyLink((inv as any).link)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/40 hover:text-white/70" title="Копировать ссылку">
                  <Link size={14} />
                </button>
                <button type="button" onClick={() => cancelMutation.mutate(inv.id)} disabled={cancelMutation.isPending} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400" title="Отменить">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
