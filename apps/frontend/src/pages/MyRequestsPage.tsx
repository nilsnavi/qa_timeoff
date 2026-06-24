import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Plane, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonCard, StatusBadge } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { RequestStatus, TimeOffRequest, VacationRequest } from '../shared/types';
import { confirmTelegram, getVacationTypeLabel, showAppToast } from '../shared/utils';

type FilterValue = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type RequestKind = 'timeoff' | 'vacation';

type MyRequestCard = {
  id: string;
  kind: RequestKind;
  typeLabel: string;
  dateLabel: string;
  amountLabel: string;
  status: RequestStatus;
  comment: string;
  createdAt?: string;
  comparableDate: string;
};

const filters: Array<{ value: FilterValue; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'PENDING', label: 'Ожидают' },
  { value: 'APPROVED', label: 'Согласованы' },
  { value: 'REJECTED', label: 'Отклонены' },
];

export function MyRequestsPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const timeOffQuery = useQuery({
    queryKey: ['timeoff', 'my'],
    queryFn: api.myTimeOff,
    enabled: hasToken,
  });
  const vacationsQuery = useQuery({
    queryKey: ['vacation', 'my'],
    queryFn: api.myVacations,
    enabled: hasToken,
  });

  const fallbackTimeOff = dashboard.requests.filter((request) => request.userId === dashboard.user.id);
  const fallbackVacations = (dashboard.vacations ?? []).filter((request) => request.userId === dashboard.user.id);
  const allRequests = useMemo(
    () =>
      [
        ...(timeOffQuery.data ?? fallbackTimeOff).map(mapTimeOffRequest),
        ...(vacationsQuery.data ?? fallbackVacations).map(mapVacationRequest),
      ].sort((a, b) => b.comparableDate.localeCompare(a.comparableDate)),
    [fallbackTimeOff, fallbackVacations, timeOffQuery.data, vacationsQuery.data],
  );
  const requests = useMemo(
    () => allRequests.filter((request) => filter === 'ALL' || request.status === filter),
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

  const cancel = useMutation({
    mutationFn: (request: MyRequestCard) => (request.kind === 'timeoff' ? api.cancelTimeOff(request.id) : api.cancelVacation(request.id)),
    onSuccess: () => {
      showAppToast('Заявка отменена');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось отменить заявку', 'Попробуйте еще раз', 'error'),
  });

  const retry = () => {
    timeOffQuery.refetch();
    vacationsQuery.refetch();
  };

  if (hasError) {
    return <ErrorState title="Заявки не загрузились" description="Не удалось получить список ваших заявок." onRetry={retry} />;
  }

  if (isLoading) {
    return <MyRequestsSkeleton />;
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#7A8599]">Мои заявки</p>
            <h2 className="text-xl font-black text-white">История заявок</h2>
          </div>
          <Badge tone="info">{requests.length}</Badge>
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
                  : 'bg-[#111A2E]/70 text-[#7A8599] ring-1 ring-white/70 bg-[#111A2E]/70 text-[#7A8599] ring-white/[0.06]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {requests.length === 0 ? (
        <EmptyState title="Заявок нет" description="Здесь появятся ваши отгулы и отпуска." />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <RequestCard
              key={`${request.kind}-${request.id}`}
              request={request}
              disabled={cancel.isPending}
              onCancel={async () => {
                if (await confirmTelegram('Отменить заявку?', `${request.typeLabel}: ${request.dateLabel}`)) {
                  cancel.mutate(request);
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MyRequestsSkeleton() {
  return (
    <>
      <SkeletonCard rows={2} />
      <SkeletonCard rows={4} />
      <SkeletonCard rows={4} />
    </>
  );
}

function RequestCard({
  request,
  disabled,
  onCancel,
}: {
  request: MyRequestCard;
  disabled: boolean;
  onCancel: () => void;
}) {
  const Icon = request.kind === 'timeoff' ? Clock3 : Plane;
  const canCancel = request.status === 'PENDING' || request.status === 'DRAFT';

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-white ${request.kind === 'timeoff' ? 'bg-blue-600' : 'bg-emerald-500'}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#7A8599]">{request.kind === 'timeoff' ? 'Отгул' : 'Отпуск'}</p>
            <h3 className="text-lg font-black text-white">{request.typeLabel}</h3>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid gap-2 rounded-[20px] bg-[#111A2E]/65 p-3 text-sm font-bold text-[#7A8599] bg-[#111A2E]/60 text-[#7A8599]">
        <InfoRow label="Дата" value={request.dateLabel} />
        <InfoRow label={request.kind === 'timeoff' ? 'Часы' : 'Дни'} value={request.amountLabel} />
        <InfoRow label="Комментарий" value={request.comment} />
        <InfoRow label="Создана" value={formatDateTime(request.createdAt)} />
      </div>

      {canCancel && (
        <Button className="mt-4 w-full" variant="secondary" disabled={disabled} onClick={onCancel}>
          <X size={18} />
          Отменить заявку
        </Button>
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

function mapTimeOffRequest(request: TimeOffRequest): MyRequestCard {
  return {
    id: request.id,
    kind: 'timeoff',
    typeLabel: 'Отгул',
    dateLabel: formatDate(request.date),
    amountLabel: `${request.hours} ч`,
    status: request.status,
    comment: request.comment || request.reason || 'Без комментария',
    createdAt: request.createdAt,
    comparableDate: request.createdAt ?? request.date,
  };
}

function mapVacationRequest(request: VacationRequest): MyRequestCard {
  return {
    id: request.id,
    kind: 'vacation',
    typeLabel: getVacationTypeLabel(request.vacationType),
    dateLabel: request.startDate === request.endDate ? formatDate(request.startDate) : `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`,
    amountLabel: `${request.daysCount} дн.`,
    status: request.status,
    comment: request.comment || 'Без комментария',
    createdAt: request.createdAt,
    comparableDate: request.createdAt ?? request.startDate,
  };
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
