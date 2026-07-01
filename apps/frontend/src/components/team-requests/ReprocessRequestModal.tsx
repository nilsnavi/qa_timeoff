import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowRight, Calendar, Users, X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { showAppToast } from '../../shared/utils';
import type { LeaveRequest } from '../../shared/types';
import { Button } from '../ui';

const TYPE_LABELS: Record<string, string> = {
  TIME_OFF: 'Отгул',
  VACATION: 'Отпуск',
  OVERTIME: 'Сверхурочные',
  OVERWORK: 'Переработка',
  REMOTE_WORK: 'Удалённая работа',
  OTHER: 'Прочее',
};

const REPROCESS_TYPES = [
  { value: 'OVERWORK', label: 'Переработка', desc: 'Компенсация за ранее отработанное время' },
  { value: 'OVERTIME', label: 'Сверхурочные', desc: 'Дополнительные часы сверх нормы' },
] as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU');
}

export function ReprocessRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [reprocessType, setReprocessType] = useState<string>('OVERWORK');
  const [managerComment, setManagerComment] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: api.users,
    staleTime: 5 * 60_000,
  });

  const approvers = useMemo(() => {
    if (!users || !request.teamId) return [];
    return users.filter(u =>
      u.teamId === request.teamId &&
      ['LEAD', 'MANAGER', 'ADMIN'].includes(u.role) &&
      u.id !== request.userId,
    ).slice(0, 3);
  }, [users, request.teamId, request.userId]);

  const slaDays = reprocessType === 'OVERTIME' ? 1 : 2;
  const slaDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + slaDays);
    return d.toLocaleDateString('ru-RU');
  }, [slaDays]);

  const reprocessMutation = useMutation({
    mutationFn: () => api.reprocessTeamRequest(request.id, { type: reprocessType, comment: managerComment || undefined }),
    onSuccess: () => {
      showAppToast('Заявка отправлена на переработку');
      queryClient.invalidateQueries({ queryKey: ['team-requests'] });
      onSuccess();
    },
    onError: (err: any) => showAppToast(err?.message ?? 'Ошибка переработки', undefined, 'error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div
        className="w-full max-w-[580px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0F1829] border border-white/[0.08]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0F1829] px-6 py-4 border-b border-white/[0.05] rounded-t-2xl">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-orange-400">Переработка</p>
            <h2 className="text-[18px] font-bold text-white">Переработка заявки</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Original request card */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
            <p className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-3">Оригинальная заявка</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-[12px] text-white/35">ID</span>
              <span className="text-[12px] font-mono text-white/50 text-right">#{request.id.slice(0, 8)}</span>
              <span className="text-[12px] text-white/35">Тип</span>
              <span className="text-[12px] text-white/70 text-right">{TYPE_LABELS[request.type] ?? request.type}</span>
              <span className="text-[12px] text-white/35">Сотрудник</span>
              <span className="text-[12px] text-white/70 text-right">{request.user?.fullName ?? '—'}</span>
              <span className="text-[12px] text-white/35">Период</span>
              <span className="text-[12px] text-white/70 text-right">
                {fmtDate(request.dateFrom)}{request.dateTo ? ` — ${fmtDate(request.dateTo)}` : ''}
              </span>
              <span className="text-[12px] text-white/35">Часы</span>
              <span className="text-[12px] text-white/70 text-right">{request.hours}ч</span>
              {request.comment && (
                <>
                  <span className="text-[12px] text-white/35">Комментарий</span>
                  <span className="text-[12px] text-white/50 italic text-right line-clamp-2">"{request.comment}"</span>
                </>
              )}
            </div>
          </div>

          {/* Reprocess type selector */}
          <div className="field-shell">
            <span className="field-label">Тип переработки</span>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {REPROCESS_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setReprocessType(t.value)}
                  className={[
                    'rounded-xl border px-3.5 py-3 text-left transition-all',
                    reprocessType === t.value
                      ? 'border-orange-500/40 bg-orange-500/10'
                      : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10]',
                  ].join(' ')}
                >
                  <p className={reprocessType === t.value ? 'text-[14px] font-bold text-orange-400' : 'text-[14px] font-semibold text-white/60'}>{t.label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Flow indicator */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/15 px-4 py-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/50">{TYPE_LABELS[request.type] ?? request.type}</div>
              <ArrowRight size={14} className="text-amber-400" />
              <div className="rounded-full bg-orange-500/20 px-2.5 py-1 text-[11px] font-bold text-orange-400">{REPROCESS_TYPES.find(t => t.value === reprocessType)?.label}</div>
            </div>
            <div className="flex-1" />
            <span className="text-[11px] text-amber-400/60">статус: На согласовании</span>
          </div>

          {/* Manager comment */}
          <div className="field-shell">
            <span className="field-label">Комментарий руководителя</span>
            <textarea
              value={managerComment}
              onChange={e => setManagerComment(e.target.value)}
              rows={2}
              placeholder="Причина переработки, дополнительные указания..."
              className="field-input resize-none"
            />
          </div>

          {/* Approvers */}
          {approvers.length > 0 && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-white/30" />
                <span className="text-[12px] font-semibold text-white/35 uppercase tracking-wider">Согласующие</span>
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">{approvers.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {approvers.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5" title={a.fullName}>
                    <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-orange-400">{a.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-[11px] text-white/50">{a.fullName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLA info */}
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-3">
            <Calendar size={14} className="text-white/30" />
            <span className="text-[12px] text-white/40">SLA согласования:</span>
            <span className="text-[13px] font-bold text-amber-400">{slaDate}</span>
            <span className="text-[12px] text-white/25 ml-auto">{slaDays} дн.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-[#0F1829] px-6 py-4 border-t border-white/[0.05] rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending || !reprocessType}
          >
            {reprocessMutation.isPending ? 'Создаём...' : 'Создать переработку'}
          </Button>
        </div>
      </div>
    </div>
  );
}
