import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, MessageSquareText, Plane, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Modal, SkeletonCard, StatusBadge, Textarea } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { TimeOffRequest, VacationRequest } from '../shared/types';
import { confirmTelegram, getVacationTypeLabel, showAppToast } from '../shared/utils';

type RequestKind = 'timeoff' | 'vacation';
type RequestCardModel = {
  id: string;
  kind: RequestKind;
  employeeName: string;
  typeLabel: string;
  dateLabel: string;
  amountLabel: string;
  reason: string;
  status: TimeOffRequest['status'];
  createdAt?: string;
  approverComment?: string;
  raw: TimeOffRequest | VacationRequest;
};

export function RequestsPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const user = dashboard.user;
  const canReview = user.role === 'LEAD' || user.role === 'MANAGER' || user.role === 'ADMIN';
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const [rejectTarget, setRejectTarget] = useState<RequestCardModel | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const myTimeOffQuery = useQuery({
    queryKey: ['timeoff', 'my'],
    queryFn: api.myTimeOff,
    enabled: hasToken && !canReview,
  });
  const myVacationsQuery = useQuery({
    queryKey: ['vacation', 'my'],
    queryFn: api.myVacations,
    enabled: hasToken && !canReview,
  });
  const pendingTimeOffQuery = useQuery({
    queryKey: ['timeoff', 'pending'],
    queryFn: api.pendingTimeOff,
    enabled: hasToken && canReview,
  });
  const pendingVacationsQuery = useQuery({
    queryKey: ['vacation', 'pending'],
    queryFn: api.pendingVacations,
    enabled: hasToken && canReview,
  });

  const invalidateRequests = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['timeoff'] });
    queryClient.invalidateQueries({ queryKey: ['vacation'] });
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
  };

  const approve = useMutation({
    mutationFn: (request: RequestCardModel) => (request.kind === 'timeoff' ? api.approveTimeOff(request.id) : api.approveVacation(request.id)),
    onSuccess: () => {
      showAppToast('Заявка одобрена');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось одобрить заявку', 'Попробуйте еще раз', 'error'),
  });
  const reject = useMutation({
    mutationFn: ({ request, comment }: { request: RequestCardModel; comment: string }) =>
      request.kind === 'timeoff' ? api.rejectTimeOff(request.id, comment) : api.rejectVacation(request.id, comment),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectComment('');
      showAppToast('Заявка отклонена');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось отклонить заявку', 'Попробуйте еще раз', 'error'),
  });
  const cancel = useMutation({
    mutationFn: (request: RequestCardModel) => (request.kind === 'timeoff' ? api.cancelTimeOff(request.id) : api.cancelVacation(request.id)),
    onSuccess: () => {
      showAppToast('Заявка отменена');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось отменить заявку', 'Попробуйте еще раз', 'error'),
  });

  const timeOff = canReview ? pendingTimeOffQuery.data : myTimeOffQuery.data;
  const vacations = canReview ? pendingVacationsQuery.data : myVacationsQuery.data;
  const requests = useMemo(
    () =>
      [
        ...(timeOff ?? fallbackTimeOff(dashboard.requests, user.id, canReview)).map(mapTimeOffRequest),
        ...(vacations ?? fallbackVacations(dashboard.vacations ?? [], user.id, canReview)).map(mapVacationRequest),
      ].sort(compareRequests),
    [canReview, dashboard.requests, dashboard.vacations, timeOff, user.id, vacations],
  );
  const isLoading = canReview
    ? pendingTimeOffQuery.isLoading || pendingVacationsQuery.isLoading
    : myTimeOffQuery.isLoading || myVacationsQuery.isLoading;
  const hasError = canReview
    ? pendingTimeOffQuery.isError || pendingVacationsQuery.isError
    : myTimeOffQuery.isError || myVacationsQuery.isError;
  const isMutating = approve.isPending || reject.isPending || cancel.isPending;

  const retryRequests = () => {
    if (canReview) {
      pendingTimeOffQuery.refetch();
      pendingVacationsQuery.refetch();
    } else {
      myTimeOffQuery.refetch();
      myVacationsQuery.refetch();
    }
  };

  if (hasError && requests.length === 0) {
    return <ErrorState title="Заявки не загрузились" description="Не удалось получить список заявок." onRetry={retryRequests} />;
  }

  if (isLoading && requests.length === 0) {
    return <RequestsSkeleton />;
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#7A8599]">{canReview ? 'Руководитель' : 'Сотрудник'}</p>
            <h2 className="text-xl font-black text-white">{canReview ? 'Заявки команды' : 'Мои заявки'}</h2>
          </div>
          <Badge tone={canReview ? 'warning' : 'info'}>{requests.length}</Badge>
        </div>
      </Card>

      {requests.length === 0 ? (
        <EmptyState title={canReview ? 'Нет заявок команды' : 'Заявок пока нет'} description={canReview ? 'Новые заявки появятся здесь.' : 'Созданные отгулы и отпуска будут отображаться здесь.'} />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <RequestCard
              key={`${request.kind}-${request.id}`}
              request={request}
              canReview={canReview}
              canCancel={!canReview && request.status === 'PENDING'}
              disabled={isMutating}
              onApprove={async () => {
                if (await confirmTelegram('Одобрить заявку?', `${request.employeeName}: ${request.typeLabel}`)) {
                  approve.mutate(request);
                }
              }}
              onReject={() => {
                setRejectTarget(request);
                setRejectComment('');
              }}
              onCancel={async () => {
                if (await confirmTelegram('Отменить заявку?', `${request.typeLabel}: ${request.dateLabel}`)) {
                  cancel.mutate(request);
                }
              }}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        title="Отклонить заявку"
        onClose={() => {
          setRejectTarget(null);
          setRejectComment('');
        }}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectTarget(null);
                setRejectComment('');
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              disabled={!rejectComment.trim() || reject.isPending || !rejectTarget}
              onClick={async () => {
                if (rejectTarget && (await confirmTelegram('Отклонить заявку?', 'Комментарий будет отправлен сотруднику.'))) {
                  reject.mutate({ request: rejectTarget, comment: rejectComment.trim() });
                }
              }}
            >
              Отклонить
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          {rejectTarget && (
            <div className="rounded-[20px] bg-[#111A2E]/70 p-3 bg-[#111A2E]/70">
              <p className="font-black text-white">{rejectTarget.employeeName}</p>
              <p className="text-sm font-bold text-[#7A8599]">
                {rejectTarget.typeLabel} · {rejectTarget.dateLabel}
              </p>
            </div>
          )}
          <Textarea
            label="Комментарий"
            value={rejectComment}
            maxLength={500}
            hint={`${rejectComment.length}/500`}
            onChange={(event) => setRejectComment(event.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}

function RequestsSkeleton() {
  return (
    <>
      <SkeletonCard rows={1} />
      <SkeletonCard rows={3} />
      <SkeletonCard rows={3} />
    </>
  );
}

function RequestCard({
  request,
  canReview,
  canCancel,
  disabled,
  onApprove,
  onReject,
  onCancel,
}: {
  request: RequestCardModel;
  canReview: boolean;
  canCancel: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const Icon = request.kind === 'timeoff' ? Clock3 : Plane;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-white ${request.kind === 'timeoff' ? 'bg-sky-500' : 'bg-emerald-500'}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#7A8599]">{request.employeeName}</p>
            <h2 className="text-lg font-black text-white">{request.typeLabel}</h2>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid gap-2 rounded-[20px] bg-[#111A2E]/65 p-3 text-sm font-bold text-[#7A8599] bg-[#111A2E]/60 text-[#7A8599]">
        <InfoRow label="Дата" value={request.dateLabel} />
        <InfoRow label={request.kind === 'timeoff' ? 'Часы' : 'Дни'} value={request.amountLabel} />
        <InfoRow label="Причина" value={request.reason} />
        {request.approverComment && <InfoRow label="Комментарий" value={request.approverComment} />}
      </div>

      {request.status === 'PENDING' && (canReview || canCancel) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {canReview ? (
            <>
              <Button variant="danger" disabled={disabled} onClick={onReject}>
                <X size={18} /> Отклонить
              </Button>
              <Button disabled={disabled} onClick={onApprove}>
                <Check size={18} /> Одобрить
              </Button>
            </>
          ) : (
            <Button className="col-span-2" variant="secondary" disabled={disabled} onClick={onCancel}>
              <X size={18} /> Отменить заявку
            </Button>
          )}
        </div>
      )}

      {request.status === 'REJECTED' && request.approverComment && (
        <div className="mt-3 flex items-start gap-2 rounded-[18px] bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          <MessageSquareText className="mt-0.5 shrink-0" size={17} />
          <span>{request.approverComment}</span>
        </div>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#7A8599]">{label}</span>
      <span className="text-right text-[#B8C0D0]">{value}</span>
    </div>
  );
}

function mapTimeOffRequest(request: TimeOffRequest): RequestCardModel {
  return {
    id: request.id,
    kind: 'timeoff',
    employeeName: request.user.fullName,
    typeLabel: 'Отгул',
    dateLabel: formatDate(request.date),
    amountLabel: `${request.hours} ч`,
    reason: request.reason || request.comment || 'Без причины',
    status: request.status,
    createdAt: request.createdAt ?? request.date,
    approverComment: request.approverComment,
    raw: request,
  };
}

function mapVacationRequest(request: VacationRequest): RequestCardModel {
  return {
    id: request.id,
    kind: 'vacation',
    employeeName: request.user.fullName,
    typeLabel: getVacationTypeLabel(request.vacationType),
    dateLabel: request.startDate === request.endDate ? formatDate(request.startDate) : `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`,
    amountLabel: `${request.daysCount} дн.`,
    reason: request.comment || getVacationTypeLabel(request.vacationType),
    status: request.status,
    createdAt: request.createdAt ?? request.startDate,
    approverComment: request.approverComment,
    raw: request,
  };
}

function fallbackTimeOff(requests: TimeOffRequest[], userId: string, canReview: boolean) {
  return requests.filter((request) => (canReview ? request.status === 'PENDING' && request.userId !== userId : request.userId === userId));
}

function fallbackVacations(requests: VacationRequest[], userId: string, canReview: boolean) {
  return requests.filter((request) => (canReview ? request.status === 'PENDING' && request.userId !== userId : request.userId === userId));
}

function compareRequests(a: RequestCardModel, b: RequestCardModel) {
  if (a.status === 'PENDING' && b.status !== 'PENDING') {
    return -1;
  }
  if (a.status !== 'PENDING' && b.status === 'PENDING') {
    return 1;
  }

  return getComparableDate(b).localeCompare(getComparableDate(a));
}

function getComparableDate(request: RequestCardModel) {
  return request.createdAt || ('date' in request.raw ? request.raw.date : request.raw.startDate);
}

function formatDate(value: string) {
  return value.slice(0, 10);
}
