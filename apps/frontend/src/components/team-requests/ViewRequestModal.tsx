import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowRight, Calendar, Check, Clock, X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../../shared/api';
import { showAppToast } from '../../shared/utils';
import type { LeaveRequest } from '../../shared/types';
import { Button } from '../ui';

const TYPE_LABELS: Record<string, string> = {
  TIME_OFF: 'Отгул', VACATION: 'Отпуск', OVERTIME: 'Сверхурочные',
  OVERWORK: 'Переработка', REMOTE_WORK: 'Удалённая работа', OTHER: 'Прочее',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик', PENDING: 'На согласовании', APPROVED: 'Одобрено',
  REJECTED: 'Отклонено', CANCELLED: 'Отменено', ACTIVE: 'Активно', EXPIRED: 'Истекло',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-white/10 text-white/40', PENDING: 'bg-amber-500/10 text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400', REJECTED: 'bg-rose-500/10 text-rose-400',
  CANCELLED: 'bg-white/5 text-white/30', ACTIVE: 'bg-blue-500/10 text-blue-400',
  EXPIRED: 'bg-orange-500/10 text-orange-400',
};

function fmtDate(d: string) { return new Date(d).toLocaleDateString('ru-RU'); }

export function ViewRequestModal({
  request,
  onClose,
  onSuccess,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const auditQuery = useQuery({
    queryKey: ['audit-log', request.id],
    queryFn: () => api.auditLog({ entityId: request.id }),
    staleTime: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['team-requests'] });
    queryClient.invalidateQueries({ queryKey: ['audit-log'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => api.approveTeamRequest(request.id),
    onSuccess: () => { showAppToast('Заявка одобрена'); invalidateAll(); onSuccess(); },
    onError: () => showAppToast('Ошибка при одобрении', undefined, 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectTeamRequest(request.id, rejectComment || undefined),
    onSuccess: () => { showAppToast('Заявка отклонена'); invalidateAll(); onSuccess(); },
    onError: () => showAppToast('Ошибка при отклонении', undefined, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTeamRequest(request.id),
    onSuccess: () => { showAppToast('Заявка удалена'); invalidateAll(); onSuccess(); },
  });

  const slaStatus = getSlaStatus(request);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div
        className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0F1829] border border-white/[0.08]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0F1829] px-6 py-4 border-b border-white/[0.05] rounded-t-2xl">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4C7DFF]">Заявка</p>
            <h2 className="text-[18px] font-bold text-white font-mono">#{request.id.slice(0, 8)}</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + SLA badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={['inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold', STATUS_CLASSES[request.status]].join(' ')}>
              {request.status === 'PENDING' && <Clock size={11} className="mr-1" />}
              {request.status === 'APPROVED' && <Check size={11} className="mr-1" />}
              {STATUS_LABELS[request.status]}
            </span>
            {request.status === 'PENDING' && (
              <>
                <ArrowRight size={12} className="text-white/15" />
                <span className={['inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold', slaStatus.cls].join(' ')}>
                  <AlertCircle size={11} className="mr-1" />
                  {slaStatus.label}
                </span>
              </>
            )}
          </div>

          {/* Main details grid */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <span className="text-[12px] text-white/35">Сотрудник</span>
              <span className="text-[13px] text-white/80 text-right">
                <span className="font-medium">{request.user?.fullName ?? '—'}</span>
                {request.user?.position && <span className="text-white/35 ml-1">{request.user.position}</span>}
              </span>
              <span className="text-[12px] text-white/35">Тип заявки</span>
              <span className="text-[13px] text-white/80 text-right">{TYPE_LABELS[request.type] ?? request.type}</span>
              <span className="text-[12px] text-white/35">Период</span>
              <span className="text-[13px] text-white/80 text-right">
                <Calendar size={11} className="inline mr-1 text-white/25" />
                {fmtDate(request.dateFrom)}{request.dateTo ? ` — ${fmtDate(request.dateTo)}` : ''}
              </span>
              <span className="text-[12px] text-white/35">Часы</span>
              <span className="text-[13px] font-bold text-white text-right">{request.hours}ч</span>
              <span className="text-[12px] text-white/35">Причина</span>
              <span className="text-[13px] text-white/60 text-right line-clamp-2">{request.reason}</span>
              {request.comment && (
                <>
                  <span className="text-[12px] text-white/35">Комментарий</span>
                  <span className="text-[13px] text-white/45 italic text-right">"{request.comment}"</span>
                </>
              )}
              {request.slaDueDate && (
                <>
                  <span className="text-[12px] text-white/35">SLA до</span>
                  <span className="text-[13px] text-white/60 text-right">{fmtDate(request.slaDueDate)}</span>
                </>
              )}
            </div>
          </div>

          {/* Approver info */}
          {request.approver && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-[#4C7DFF]/20 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-[#4C7DFF]">{request.approver.fullName[0].toUpperCase()}</span>
                </div>
                <span className="text-[12px] text-white/35">Согласующий: </span>
                <span className="text-[13px] text-white/80 font-medium">{request.approver.fullName}</span>
                {request.approvedAt && <span className="text-[11px] text-white/25 ml-auto">{fmtDate(request.approvedAt)}</span>}
              </div>
              {request.approverComment && (
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 mt-2">
                  <p className="text-[12px] text-white/45 italic">"{request.approverComment}"</p>
                </div>
              )}
            </div>
          )}

          {/* SLA warning for pending */}
          {request.status === 'PENDING' && slaStatus.severity !== 'ok' && (
            <div className={[
              'flex items-start gap-2.5 rounded-xl px-4 py-3',
              slaStatus.severity === 'overdue' ? 'bg-rose-500/10 border border-rose-500/15' : 'bg-amber-500/10 border border-amber-500/15',
            ].join(' ')}>
              <AlertCircle size={15} className={slaStatus.severity === 'overdue' ? 'text-rose-400 shrink-0 mt-0.5' : 'text-amber-400 shrink-0 mt-0.5'} />
              <div>
                <p className={['text-[13px] font-semibold', slaStatus.severity === 'overdue' ? 'text-rose-400' : 'text-amber-400'].join(' ')}>
                  {slaStatus.severity === 'overdue' ? 'SLA просрочен' : 'SLA приближается'}
                </p>
                <p className="text-[12px] text-white/40 mt-0.5">
                  {slaStatus.severity === 'overdue'
                    ? 'Срок согласования истёк. Рекомендуется незамедлительно принять решение.'
                    : 'Срок согласования истекает. Пожалуйста, рассмотрите заявку.'}
                </p>
              </div>
            </div>
          )}

          {/* Audit log */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
            <p className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-3">История действий</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <AuditEntry label="Создана" date={request.createdAt} user={request.user?.fullName} />
              {request.status === 'APPROVED' && request.approvedAt && (
                <AuditEntry label="Одобрена" date={request.approvedAt!} user={request.approver?.fullName} />
              )}
              {request.status === 'REJECTED' && (
                <AuditEntry label="Отклонена" date={request.updatedAt} user={request.approver?.fullName} />
              )}
              {auditQuery.data?.items?.map((log: any) => (
                <AuditEntry
                  key={log.id}
                  label={log.action === 'REMINDER' ? 'Напоминание' : log.action}
                  date={log.timestamp ?? log.createdAt}
                  user={log.actorName ?? log.actor?.fullName}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-[#0F1829] px-6 py-4 border-t border-white/[0.05] rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          <div className="flex items-center gap-2">
            {request.status === 'PENDING' && (
              <>
                {showRejectInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={rejectComment}
                      onChange={e => setRejectComment(e.target.value)}
                      placeholder="Причина отклонения..."
                      className="h-9 w-48 rounded-lg bg-white/[0.04] border border-rose-500/20 px-3 text-[13px] text-white/70 placeholder:text-white/15 outline-none"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => rejectMutation.mutate()}
                      disabled={rejectMutation.isPending}
                      className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400"
                    >
                      Подтвердить
                    </Button>
                    <button onClick={() => { setShowRejectInput(false); setRejectComment(''); }} className="text-[12px] text-white/30 hover:text-white/60">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => setShowRejectInput(true)}
                      className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                    >
                      <X size={14} className="mr-1" /> Отклонить
                    </Button>
                    <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                      <Check size={14} className="mr-1" /> Одобрить
                    </Button>
                  </>
                )}
              </>
            )}
            {request.status === 'DRAFT' && (
              <Button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-400">
                <X size={14} className="mr-1" /> Удалить
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditEntry({ label, date, user }: { label: string; date: string; user?: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <div className="h-1 w-1 rounded-full bg-[#4C7DFF]/40 shrink-0" />
      <span className="text-white/25 w-20 shrink-0">{label}</span>
      <span className="text-white/20">—</span>
      <span className="text-white/45 truncate">{user ?? 'Система'}</span>
      <span className="text-white/15 ml-auto shrink-0">{new Date(date).toLocaleDateString('ru-RU')}</span>
    </div>
  );
}

function getSlaStatus(request: LeaveRequest) {
  if (request.status !== 'PENDING' || !request.slaDueDate) {
    return { severity: 'ok' as const, label: '', cls: '' };
  }
  const now = new Date();
  const sla = new Date(request.slaDueDate);
  const diffHours = (sla.getTime() - now.getTime()) / 3600000;
  if (diffHours < 0) return { severity: 'overdue' as const, label: 'Просрочен', cls: 'bg-rose-500/15 text-rose-400' };
  if (diffHours < 24) return { severity: 'warning' as const, label: 'Скоро', cls: 'bg-amber-500/15 text-amber-400' };
  return { severity: 'ok' as const, label: 'В норме', cls: 'bg-emerald-500/15 text-emerald-400' };
}
