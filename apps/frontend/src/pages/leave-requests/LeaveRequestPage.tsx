import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Clock, MessageSquareText, Plane, Plus, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateRequestModal } from '../../components/leave-requests/CreateRequestModal';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonCard, StatusBadge } from '../../components/ui';
import { api } from '../../shared/api';
import { useDashboard } from '../../shared/hooks/useDashboard';
import type { LeaveRequest } from '../../shared/types';
import { confirmTelegram, hapticSelection, showAppToast } from '../../shared/utils';

type FilterValue = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'PENDING', label: 'Ожидают' },
  { value: 'APPROVED', label: 'Одобрены' },
  { value: 'REJECTED', label: 'Отклонены' },
];

export function LeaveRequestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const currentUser = dashboard.user;
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const isManager = currentUser.role === 'LEAD' || currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN';

  const params = useMemo(() => {
    const p: Record<string, string | number> = { limit: 50 };
    if (filter !== 'ALL') p.status = filter;
    return p;
  }, [filter]);

  const requestsQuery = useQuery({
    queryKey: ['leave-requests', params],
    queryFn: () => api.leaveRequests(params as { status?: string; page?: number; limit?: number }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const summaryQuery = useQuery({
    queryKey: ['leave-requests', 'summary'],
    queryFn: api.leaveRequestsSummary,
    enabled: isManager,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests', params] });
    queryClient.invalidateQueries({ queryKey: ['leave-requests', 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveLeaveRequest(id),
    onSuccess: () => {
      showAppToast('Заявка одобрена');
      invalidate();
    },
    onError: () => showAppToast('Не удалось одобрить заявку', undefined, 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => api.rejectLeaveRequest(id, comment),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectComment('');
      showAppToast('Заявка отклонена');
      invalidate();
    },
    onError: () => showAppToast('Не удалось отклонить заявку', undefined, 'error'),
  });

  const requests = requestsQuery.data?.items ?? [];
  const isLoading = requestsQuery.isLoading;
  const hasError = requestsQuery.isError;
  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  const pendingCount = summaryQuery.data?.pendingCount ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────

  if (hasError && requests.length === 0) {
    return <ErrorState title="Заявки не загрузились" description="Не удалось получить список заявок." onRetry={() => requestsQuery.refetch()} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 pb-24 safe-area">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#4C7DFF] to-[#7C5CFF] text-[9px] font-bold text-white">
            {currentUser.fullName?.slice(0, 2).toUpperCase() ?? 'QA'}
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">QA_TimeOff</h1>
            <Badge tone={currentUser.role === 'ADMIN' ? 'gradient' : 'info'} className="text-[8px]">
              {currentUser.role === 'ADMIN' ? 'Админ' : currentUser.role === 'MANAGER' ? 'Менеджер' : currentUser.role === 'LEAD' ? 'Тимлид' : 'Сотрудник'}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { hapticSelection(); navigate('/notifications'); }}
          className="relative grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-white/50"
          aria-label="Уведомления"
        >
          <Bell size={16} />
        </button>
      </header>

      {/* Team Summary */}
      {isManager && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-blue-500/15 text-blue-400">
                <Users size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Заявки команды</p>
                <p className="text-[10px] font-medium text-white/40">
                  {summaryQuery.data ? `Всего: ${summaryQuery.data.total}` : 'Загрузка...'}
                </p>
              </div>
            </div>
            {pendingCount > 0 && (
              <Badge tone="warning">{pendingCount} ожидает</Badge>
            )}
          </div>
        </Card>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`min-h-9 shrink-0 rounded-[18px] px-3.5 text-xs font-bold transition ${
              filter === item.value
                ? 'app-gradient text-white shadow-lg shadow-blue-500/20'
                : 'bg-white/[0.06] text-white/50 ring-1 ring-white/[0.06]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Request List */}
      {isLoading && requests.length === 0 ? (
        <div className="grid gap-3">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="Нет заявок"
          description={filter === 'ALL' ? 'Заявки пока не созданы.' : `Нет заявок со статусом "${FILTERS.find(f => f.value === filter)?.label}".`}
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Создать заявку
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              canReview={isManager && request.userId !== currentUser.id}
              disabled={isMutating}
              onApprove={async () => {
                if (await confirmTelegram('Одобрить заявку?', `${request.user.fullName}: ${getTypeLabel(request.type)}`)) {
                  approveMutation.mutate(request.id);
                }
              }}
              onReject={() => {
                setRejectTarget(request);
                setRejectComment('');
              }}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => { hapticSelection(); setModalOpen(true); }}
        className="fixed bottom-[calc(5rem+max(var(--tg-safe-bottom),env(safe-area-inset-bottom)))] right-5 z-20 grid h-12 w-12 place-items-center rounded-2xl app-gradient text-white shadow-lg shadow-blue-500/30 active:scale-90 transition-transform"
        aria-label="Создать заявку"
      >
        <Plus size={22} />
      </button>

      {/* Create Request Modal */}
      <CreateRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 backdrop-blur-sm sm:place-items-center">
          <section className="enterprise-card w-full max-w-md p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white">Отклонить заявку</h2>
              <Button variant="ghost" size="sm" onClick={() => { setRejectTarget(null); setRejectComment(''); }}>
                <X size={14} />
              </Button>
            </div>

            <div className="rounded-[10px] bg-white/[0.04] p-3 mb-3">
              <p className="text-xs font-bold text-white">{rejectTarget.user.fullName}</p>
              <p className="text-[10px] font-medium text-white/50">
                {getTypeLabel(rejectTarget.type)} · {formatDate(rejectTarget.dateFrom)}{rejectTarget.dateTo ? ` - ${formatDate(rejectTarget.dateTo)}` : ''}
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-white/60">Комментарий</label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                maxLength={500}
                placeholder="Укажите причину отклонения..."
                className="min-h-20 w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-white outline-none placeholder:text-white/30 focus:border-[#4C7DFF]/50 resize-none"
              />
              <span className="text-[10px] font-medium text-white/30">{rejectComment.length}/500</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectComment(''); }}>
                Отмена
              </Button>
              <Button
                variant="danger"
                disabled={!rejectComment.trim() || rejectMutation.isPending}
                onClick={async () => {
                  if (await confirmTelegram('Отклонить заявку?', 'Комментарий будет отправлен сотруднику.')) {
                    rejectMutation.mutate({ id: rejectTarget.id, comment: rejectComment.trim() });
                  }
                }}
              >
                Отклонить
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ── Request Card Component ──────────────────────────────────────────────────

function RequestCard({
  request,
  canReview,
  disabled,
  onApprove,
  onReject,
}: {
  request: LeaveRequest;
  canReview: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const Icon = request.type === 'TIME_OFF' ? Clock : Plane;
  const dateLabel = request.dateTo && request.dateFrom !== request.dateTo
    ? `${formatDate(request.dateFrom)} - ${formatDate(request.dateTo)}`
    : formatDate(request.dateFrom);

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-white ${
            request.type === 'TIME_OFF' ? 'bg-sky-500' : 'bg-emerald-500'
          }`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white/50">{request.user.fullName}</p>
            <h3 className="text-sm font-bold text-white">{getTypeLabel(request.type)}</h3>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid gap-1.5 rounded-[14px] bg-white/[0.04] p-3 text-xs font-medium">
        <InfoRow label="Дата" value={dateLabel} />
        <InfoRow label="Часы" value={`${request.hours} ч`} />
        <InfoRow label="Причина" value={request.reason} />
        {request.comment && <InfoRow label="Комментарий" value={request.comment} />}
        {request.approverComment && <InfoRow label="Ответ руководителя" value={request.approverComment} />}
      </div>

      {request.status === 'PENDING' && canReview && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="danger" disabled={disabled} onClick={onReject}>
            <X size={16} /> Отклонить
          </Button>
          <Button disabled={disabled} onClick={onApprove}>
            <Check size={16} /> Одобрить
          </Button>
        </div>
      )}

      {request.status === 'REJECTED' && request.approverComment && (
        <div className="mt-3 flex items-start gap-2 rounded-[14px] bg-rose-500/10 p-3">
          <MessageSquareText className="mt-0.5 shrink-0 text-rose-400" size={14} />
          <span className="text-xs font-medium text-rose-300">{request.approverComment}</span>
        </div>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className="text-right text-white/80">{value}</span>
    </div>
  );
}

function getTypeLabel(type: string) {
  return type === 'TIME_OFF' ? 'Отгул' : 'Отпуск';
}

function formatDate(value: string) {
  return value.slice(0, 10).split('-').reverse().join('.');
}
