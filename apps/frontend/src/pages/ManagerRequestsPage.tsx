import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Plane, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Modal, SkeletonCard, Textarea } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { TimeOffRequest, VacationRequest } from '../shared/types';
import { confirmTelegram, getVacationTypeLabel, showAppToast } from '../shared/utils';

type FilterValue = 'ALL' | 'TIME_OFF' | 'VACATION';
type RequestKind = 'timeoff' | 'vacation';

type ManagerRequestCard = {
  id: string;
  kind: RequestKind;
  employeeName: string;
  employeePosition: string;
  balanceLabel: string;
  typeLabel: string;
  dateLabel: string;
  amountLabel: string;
  reason: string;
  createdAt?: string;
  comparableDate: string;
};

const filters: Array<{ value: FilterValue; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'TIME_OFF', label: 'Отгулы' },
  { value: 'VACATION', label: 'Отпуска' },
];

export function ManagerRequestsPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [rejectTarget, setRejectTarget] = useState<ManagerRequestCard | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const timeOffQuery = useQuery({
    queryKey: ['timeoff', 'pending'],
    queryFn: api.pendingTimeOff,
    enabled: hasToken,
  });
  const vacationsQuery = useQuery({
    queryKey: ['vacation', 'pending'],
    queryFn: api.pendingVacations,
    enabled: hasToken,
  });

  const fallbackTimeOff = dashboard.requests.filter((request) => request.status === 'PENDING' && request.userId !== dashboard.user.id);
  const fallbackVacations = (dashboard.vacations ?? []).filter((request) => request.status === 'PENDING' && request.userId !== dashboard.user.id);
  const allRequests = useMemo(
    () =>
      [
        ...(timeOffQuery.data ?? fallbackTimeOff).map(mapTimeOffRequest),
        ...(vacationsQuery.data ?? fallbackVacations).map(mapVacationRequest),
      ].sort((a, b) => a.comparableDate.localeCompare(b.comparableDate)),
    [fallbackTimeOff, fallbackVacations, timeOffQuery.data, vacationsQuery.data],
  );
  const requests = useMemo(
    () => allRequests.filter((request) => filter === 'ALL' || (filter === 'TIME_OFF' ? request.kind === 'timeoff' : request.kind === 'vacation')),
    [allRequests, filter],
  );
  const isLoading = (timeOffQuery.isLoading || vacationsQuery.isLoading) && allRequests.length === 0;
  const hasError = (timeOffQuery.isError || vacationsQuery.isError) && allRequests.length === 0;

  const invalidateRequests = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['timeoff'] });
    queryClient.invalidateQueries({ queryKey: ['vacation'] });
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
  };

  const approve = useMutation({
    mutationFn: (request: ManagerRequestCard) => (request.kind === 'timeoff' ? api.approveTimeOff(request.id) : api.approveVacation(request.id)),
    onSuccess: () => {
      showAppToast('Заявка согласована');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось согласовать заявку', 'Попробуйте еще раз', 'error'),
  });

  const reject = useMutation({
    mutationFn: ({ request, comment }: { request: ManagerRequestCard; comment: string }) =>
      request.kind === 'timeoff' ? api.rejectTimeOff(request.id, comment) : api.rejectVacation(request.id, comment),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectComment('');
      showAppToast('Заявка отклонена');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось отклонить заявку', 'Попробуйте еще раз', 'error'),
  });

  const retry = () => {
    timeOffQuery.refetch();
    vacationsQuery.refetch();
  };

  if (hasError) {
    return <ErrorState title="Заявки не загрузились" description="Не удалось получить список заявок на согласование." onRetry={retry} />;
  }

  if (isLoading) {
    return <ManagerRequestsSkeleton />;
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Руководитель</p>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Заявки команды</h2>
          </div>
          <Badge tone="warning">{requests.length}</Badge>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`min-h-10 shrink-0 rounded-[18px] px-4 text-sm font-black transition ${
                filter === item.value
                  ? 'app-gradient text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/70 text-slate-600 ring-1 ring-white/70 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {requests.length === 0 ? (
        <EmptyState title="Заявок нет" description="Новые заявки команды появятся здесь." />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <RequestCard
              key={`${request.kind}-${request.id}`}
              request={request}
              disabled={approve.isPending || reject.isPending}
              onApprove={async () => {
                if (await confirmTelegram('Согласовать заявку?', `${request.employeeName}: ${request.typeLabel}`)) {
                  approve.mutate(request);
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

      <RejectModal
        target={rejectTarget}
        comment={rejectComment}
        pending={reject.isPending}
        onCommentChange={setRejectComment}
        onClose={() => {
          setRejectTarget(null);
          setRejectComment('');
        }}
        onSubmit={() => {
          if (rejectTarget) {
            reject.mutate({ request: rejectTarget, comment: rejectComment.trim() });
          }
        }}
      />
    </>
  );
}

function ManagerRequestsSkeleton() {
  return (
    <>
      <SkeletonCard rows={2} />
      <SkeletonCard rows={5} />
      <SkeletonCard rows={5} />
    </>
  );
}

function RequestCard({
  request,
  disabled,
  onApprove,
  onReject,
}: {
  request: ManagerRequestCard;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const Icon = request.kind === 'timeoff' ? Clock3 : Plane;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-white/75 text-slate-700 shadow-soft dark:bg-slate-900/70 dark:text-slate-200">
            <UserRound size={22} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-950 dark:text-white">{request.employeeName}</p>
            <p className="truncate text-sm font-bold text-slate-500 dark:text-slate-400">{request.employeePosition}</p>
          </div>
        </div>
        <Badge tone={request.kind === 'timeoff' ? 'info' : 'success'}>{request.kind === 'timeoff' ? 'Отгул' : 'Отпуск'}</Badge>
      </div>

      <div className="mb-3 grid grid-cols-[auto_1fr] items-center gap-3 rounded-[20px] bg-white/65 p-3 dark:bg-slate-900/60">
        <div className={`grid h-11 w-11 place-items-center rounded-[18px] text-white ${request.kind === 'timeoff' ? 'bg-blue-600' : 'bg-emerald-500'}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950 dark:text-white">{request.typeLabel}</p>
          <p className="truncate text-sm font-bold text-slate-500 dark:text-slate-400">
            {request.dateLabel} · {request.amountLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-[20px] bg-white/65 p-3 text-sm font-bold text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
        <InfoRow label="Баланс" value={request.balanceLabel} />
        <InfoRow label="Причина" value={request.reason} />
        <InfoRow label="Создана" value={formatDateTime(request.createdAt)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="danger" disabled={disabled} onClick={onReject}>
          <X size={18} />
          Отклонить
        </Button>
        <Button disabled={disabled} onClick={onApprove}>
          <Check size={18} />
          Согласовать
        </Button>
      </div>
    </Card>
  );
}

function RejectModal({
  target,
  comment,
  pending,
  onCommentChange,
  onClose,
  onSubmit,
}: {
  target: ManagerRequestCard | null;
  comment: string;
  pending: boolean;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      open={!!target}
      title="Отклонить заявку"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" disabled={!comment.trim() || pending || !target} onClick={onSubmit}>
            Отклонить
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        {target && (
          <div className="rounded-[20px] bg-white/70 p-3 dark:bg-slate-900/70">
            <p className="font-black text-slate-950 dark:text-white">{target.employeeName}</p>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {target.typeLabel} · {target.dateLabel}
            </p>
          </div>
        )}
        <Textarea
          label="Комментарий"
          value={comment}
          maxLength={500}
          hint={`${comment.length}/500`}
          placeholder="Напишите причину отказа"
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}

function mapTimeOffRequest(request: TimeOffRequest): ManagerRequestCard {
  return {
    id: request.id,
    kind: 'timeoff',
    employeeName: request.user.fullName,
    employeePosition: request.user.position || 'Сотрудник',
    balanceLabel: formatBalance(request.user.timeBalance?.balanceHours),
    typeLabel: 'Отгул',
    dateLabel: formatDate(request.date),
    amountLabel: `${request.hours} ч`,
    reason: request.reason || request.comment || 'Без причины',
    createdAt: request.createdAt,
    comparableDate: request.createdAt ?? request.date,
  };
}

function mapVacationRequest(request: VacationRequest): ManagerRequestCard {
  return {
    id: request.id,
    kind: 'vacation',
    employeeName: request.user.fullName,
    employeePosition: request.user.position || 'Сотрудник',
    balanceLabel: formatBalance(request.user.timeBalance?.balanceHours),
    typeLabel: getVacationTypeLabel(request.vacationType),
    dateLabel: request.startDate === request.endDate ? formatDate(request.startDate) : `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`,
    amountLabel: `${request.daysCount} дн.`,
    reason: request.comment || getVacationTypeLabel(request.vacationType),
    createdAt: request.createdAt,
    comparableDate: request.createdAt ?? request.startDate,
  };
}

function formatBalance(value?: number) {
  return typeof value === 'number' ? `${value} ч` : 'Нет данных';
}

function formatDate(value: string) {
  return value.slice(0, 10).split('-').reverse().join('.');
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Нет данных';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDate(value);
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
