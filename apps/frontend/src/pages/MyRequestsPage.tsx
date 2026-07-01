import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronDown, Clock3, Edit3, Plane, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CustomSelect, EmptyState, ErrorState, Field, Modal, SkeletonCard, StatusBadge } from '../components/ui';

import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import type { LeaveRequest, RequestStatus, TimeOffRequest, VacationRequest } from '../shared/types';
import { confirmTelegram, getVacationTypeLabel, showAppToast } from '../shared/utils';

type FilterValue = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type RequestKind = 'timeoff' | 'vacation' | 'team';

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

const filterDefs: Array<{ value: FilterValue; labelKey: keyof typeof defaultFilterLabels }> = [
  { value: 'ALL', labelKey: 'ALL' },
  { value: 'PENDING', labelKey: 'PENDING' },
  { value: 'APPROVED', labelKey: 'APPROVED' },
  { value: 'REJECTED', labelKey: 'REJECTED' },
];

const defaultFilterLabels: Record<string, string> = {
  ALL: 'Все',
  PENDING: 'Ожидают',
  APPROVED: 'Согласованы',
  REJECTED: 'Отклонены',
};

function getPeriodRange(period: string): { from: string; to: string } | undefined {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if (period === 'month') {
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
      to:   fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: fmt(new Date(now.getFullYear(), q * 3, 1)),
      to:   fmt(new Date(now.getFullYear(), q * 3 + 3, 0)),
    };
  }
  if (period === 'year') {
    return {
      from: fmt(new Date(now.getFullYear(), 0, 1)),
      to:   fmt(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return undefined;
}

export function MyRequestsPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [period, setPeriod] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [kindFilter, setKindFilter] = useState<'ALL'|'timeoff'|'vacation'|'team'>('ALL');
  const [cursorTimeOff, setCursorTimeOff] = useState<string | undefined>(undefined);
  const [cursorVacation, setCursorVacation] = useState<string | undefined>(undefined);
  const [hasMoreTimeOff, setHasMoreTimeOff] = useState(true);
  const [hasMoreVacation, setHasMoreVacation] = useState(true);
  const [accTimeOff, setAccTimeOff] = useState<TimeOffRequest[]>([]);
  const [accVacations, setAccVacations] = useState<VacationRequest[]>([]);
  const [accTeamRequests, setAccTeamRequests] = useState<LeaveRequest[]>([]);
  const [editTarget, setEditTarget] = useState<MyRequestCard | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editHours, setEditHours] = useState(0);
  const [editReason, setEditReason] = useState('');

  const PAGE_LIMIT = 15;

  const dateRange = useMemo(() => {
    if (period === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
    return getPeriodRange(period);
  }, [period, customFrom, customTo]);

  const timeOffQuery = useQuery({
    queryKey: ['timeoff', 'my', filter, period, customFrom, customTo],
    queryFn: () => api.myTimeOff({
      status: filter !== 'ALL' ? filter : undefined,
      from: dateRange?.from,
      to:   dateRange?.to,
      limit: PAGE_LIMIT,
    }),
    enabled: hasToken && (kindFilter === 'ALL' || kindFilter === 'timeoff'),
  });

  const vacationsQuery = useQuery({
    queryKey: ['vacation', 'my', filter, period, customFrom, customTo],
    queryFn: () => api.myVacations({
      status: filter !== 'ALL' ? filter : undefined,
      from: dateRange?.from,
      to:   dateRange?.to,
      limit: PAGE_LIMIT,
    }),
    enabled: hasToken && (kindFilter === 'ALL' || kindFilter === 'vacation'),
  });

  const teamRequestsQuery = useQuery({
    queryKey: ['team-requests', 'my', filter, period, customFrom, customTo],
    queryFn: () => api.myTeamRequests({
      status: filter !== 'ALL' ? filter : undefined,
      from: dateRange?.from,
      to:   dateRange?.to,
      limit: PAGE_LIMIT,
    }),
    enabled: hasToken && (kindFilter === 'ALL' || kindFilter === 'team'),
  });

  useEffect(() => {
    if (timeOffQuery.data) {
      setAccTimeOff(timeOffQuery.data.slice(0, PAGE_LIMIT));
      setHasMoreTimeOff(timeOffQuery.data.length > PAGE_LIMIT);
      setCursorTimeOff(timeOffQuery.data[PAGE_LIMIT - 1]?.id);
    }
  }, [timeOffQuery.data]);

  useEffect(() => {
    if (vacationsQuery.data) {
      setAccVacations(vacationsQuery.data.slice(0, PAGE_LIMIT));
      setHasMoreVacation(vacationsQuery.data.length > PAGE_LIMIT);
      setCursorVacation(vacationsQuery.data[PAGE_LIMIT - 1]?.id);
    }
  }, [vacationsQuery.data]);

  useEffect(() => {
    if (teamRequestsQuery.data) {
      setAccTeamRequests(teamRequestsQuery.data.items.slice(0, PAGE_LIMIT));
    }
  }, [teamRequestsQuery.data]);

  useEffect(() => {
    setAccTimeOff([]);
    setAccVacations([]);
    setAccTeamRequests([]);
    setCursorTimeOff(undefined);
    setCursorVacation(undefined);
    setHasMoreTimeOff(true);
    setHasMoreVacation(true);
  }, [filter, period, customFrom, customTo, kindFilter]);

  const loadMoreTimeOff = async () => {
    if (!cursorTimeOff) return;
    const more = await api.myTimeOff({
      status: filter !== 'ALL' ? filter : undefined,
      from: dateRange?.from,
      to:   dateRange?.to,
      limit: PAGE_LIMIT,
      cursor: cursorTimeOff,
    });
    const items = more.slice(0, PAGE_LIMIT);
    setAccTimeOff(prev => [...prev, ...items]);
    setHasMoreTimeOff(more.length > PAGE_LIMIT);
    setCursorTimeOff(items[items.length - 1]?.id);
  };

  const loadMoreVacations = async () => {
    if (!cursorVacation) return;
    const more = await api.myVacations({
      status: filter !== 'ALL' ? filter : undefined,
      from: dateRange?.from,
      to:   dateRange?.to,
      limit: PAGE_LIMIT,
      cursor: cursorVacation,
    });
    const items = more.slice(0, PAGE_LIMIT);
    setAccVacations(prev => [...prev, ...items]);
    setHasMoreVacation(more.length > PAGE_LIMIT);
    setCursorVacation(items[items.length - 1]?.id);
  };

  const _fallbackTimeOff = dashboard.requests.filter((request) => request.userId === dashboard.user.id);
  const _fallbackVacations = (dashboard.vacations ?? []).filter((request) => request.userId === dashboard.user.id);
  const allRequests = useMemo(
    () =>
      [
        ...accTimeOff.length > 0 ? accTimeOff.map(mapTimeOffRequest) : [],
        ...accVacations.length > 0 ? accVacations.map(mapVacationRequest) : [],
        ...accTeamRequests.length > 0 ? accTeamRequests.map(mapTeamRequest) : [],
      ]
        .filter(r => kindFilter === 'ALL' || r.kind === kindFilter)
        .sort((a, b) => b.comparableDate.localeCompare(a.comparableDate)),
    [accTimeOff, accVacations, accTeamRequests, kindFilter],
  );

  const requests = allRequests;

  const counts = useMemo(() => ({
    ALL: allRequests.length,
    PENDING: allRequests.filter(r => r.status === 'PENDING').length,
    APPROVED: allRequests.filter(r => r.status === 'APPROVED').length,
    REJECTED: allRequests.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  }), [allRequests]);

  const filters = useMemo(() => filterDefs.map(f => ({
    ...f,
    label: `${defaultFilterLabels[f.labelKey]} (${counts[f.value]})`,
  })), [counts]);
  const isLoading = (timeOffQuery.isLoading || vacationsQuery.isLoading || teamRequestsQuery.isLoading) && allRequests.length === 0;
  const hasError = (timeOffQuery.isError || vacationsQuery.isError || teamRequestsQuery.isError) && allRequests.length === 0;

  const invalidateRequests = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['timeoff'] });
    queryClient.invalidateQueries({ queryKey: ['vacation'] });
    queryClient.invalidateQueries({ queryKey: ['team-requests'] });
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
  };

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { date?: string; hours?: number; reason?: string } }) =>
      api.updateTimeOff(id, payload),
    onSuccess: () => {
      showAppToast('Заявка изменена');
      setEditTarget(null);
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось изменить заявку', undefined, 'error'),
  });

  const cancel = useMutation({
    mutationFn: (request: MyRequestCard) => {
      if (request.kind === 'timeoff') return api.cancelTimeOff(request.id);
      if (request.kind === 'vacation') return api.cancelVacation(request.id);
      return api.deleteTeamRequest(request.id);
    },
    onSuccess: () => {
      showAppToast('Заявка отменена');
      invalidateRequests();
    },
    onError: () => showAppToast('Не удалось отменить заявку', 'Попробуйте еще раз', 'error'),
  });

  const retry = () => {
    timeOffQuery.refetch();
    vacationsQuery.refetch();
    teamRequestsQuery.refetch();
  };

  const hasMore = hasMoreTimeOff || hasMoreVacation;
  const loadMore = () => {
    if (hasMoreTimeOff)  loadMoreTimeOff();
    if (hasMoreVacation) loadMoreVacations();
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

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`min-h-10 shrink-0 rounded-[18px] px-4 text-sm font-black transition ${
                filter === item.value
                  ? 'app-gradient text-white shadow-lg shadow-blue-500/20'
                  : 'bg-[#111A2E]/70 text-[#7A8599] ring-1 ring-white/[0.06]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="w-40">
            <CustomSelect
              value={kindFilter}
              onChange={v => setKindFilter(v as 'ALL'|'timeoff'|'vacation'|'team')}
              options={[
                { value: 'ALL',      label: 'Все типы' },
                { value: 'timeoff',  label: 'Отгулы'   },
                { value: 'vacation', label: 'Отпуска'  },
                { value: 'team',     label: 'Команда'  },
              ]}
              small
            />
          </div>

          <div className="w-52">
            <CustomSelect
              value={period}
              onChange={v => { setPeriod(v); setShowCustom(v === 'custom'); }}
              options={[
                { value: 'all',     label: 'Любой период'     },
                { value: 'month',   label: 'Текущий месяц'    },
                { value: 'quarter', label: 'Текущий квартал'  },
                { value: 'year',    label: 'Текущий год'      },
                { value: 'custom',  label: 'Произвольный...'  },
              ]}
              small
            />
          </div>
        </div>

        {showCustom && (
          <div className="mt-2 flex gap-2 items-center">
            <Calendar size={14} className="text-white/30 shrink-0" />
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="field-input text-[13px] py-1.5 flex-1"
            />
            <span className="text-white/30 text-[13px]">—</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="field-input text-[13px] py-1.5 flex-1"
            />
          </div>
        )}
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
              onEdit={request.status === 'PENDING' && request.kind === 'timeoff' ? () => {
                setEditTarget(request);
                setEditDate(request.dateLabel.split('.').reverse().join('-'));
                const hours = parseInt(request.amountLabel);
                setEditHours(Number.isNaN(hours) ? 0 : hours);
                setEditReason(request.comment === 'Без комментария' ? '' : request.comment);
              } : undefined}
            />
          ))}
        </div>
      )}

      {hasMore && requests.length > 0 && (
        <button
          type="button"
          onClick={loadMore}
          className="flex w-full items-center justify-center gap-2 rounded-[18px]
                     bg-[#111A2E]/70 text-[#7A8599] ring-1 ring-white/[0.06]
                     py-3 text-sm font-bold transition hover:text-white/70"
        >
          <ChevronDown size={16} />
          Показать ещё
        </button>
      )}

      {editTarget && (
        <Modal open title="Изменить отгул" onClose={() => setEditTarget(null)}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={() => setEditTarget(null)}>Отмена</Button><Button onClick={() => update.mutate({ id: editTarget.id, payload: { date: editDate, hours: editHours, reason: editReason } })} disabled={update.isPending}>{update.isPending ? 'Сохранение...' : 'Сохранить'}</Button></div>}>
          <div className="space-y-4">
            <Field label="Дата" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            <Field label="Часы" type="number" value={String(editHours)} onChange={e => setEditHours(Number(e.target.value))} />
            <Field label="Причина" value={editReason} onChange={e => setEditReason(e.target.value)} />
          </div>
        </Modal>
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
  onEdit,
}: {
  request: MyRequestCard;
  disabled: boolean;
  onCancel: () => void;
  onEdit?: () => void;
}) {
  const Icon = request.kind === 'timeoff' ? Clock3 : request.kind === 'team' ? Users : Plane;
  const canCancel = request.status === 'PENDING' || request.status === 'DRAFT';

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-white ${request.kind === 'timeoff' ? 'bg-blue-600' : request.kind === 'team' ? 'bg-purple-600' : 'bg-emerald-500'}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#7A8599]">{request.kind === 'timeoff' ? 'Отгул' : request.kind === 'team' ? 'Заявка команды' : 'Отпуск'}</p>
            <h3 className="text-lg font-black text-white">{request.typeLabel}</h3>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid gap-2 rounded-[20px] bg-[#111A2E]/65 p-3 text-sm font-bold text-[#7A8599] bg-[#111A2E]/60 text-[#7A8599]">
        <InfoRow label="Дата" value={request.dateLabel} />
        <InfoRow label={request.kind === 'vacation' ? 'Дни' : 'Часы'} value={request.amountLabel} />
        <InfoRow label="Комментарий" value={request.comment} />
        <InfoRow label="Создана" value={formatDateTime(request.createdAt)} />
      </div>

      <div className="mt-4 flex gap-2">
        {onEdit && (
          <Button className="flex-1" variant="secondary" onClick={onEdit}>
            <Edit3 size={18} />
            Изменить
          </Button>
        )}
        {canCancel && (
          <Button className={onEdit ? 'flex-1' : 'w-full'} variant="secondary" disabled={disabled} onClick={onCancel}>
            <X size={18} />
            Отменить
          </Button>
        )}
      </div>
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

const teamRequestTypeLabels: Record<string, string> = {
  TIME_OFF: 'Отгул',
  VACATION: 'Отпуск',
  OVERTIME: 'Переработка',
  OVERWORK: 'Доработка',
  REMOTE_WORK: 'Удалённая работа',
  OTHER: 'Другое',
};

function mapTeamRequest(request: LeaveRequest): MyRequestCard {
  const dates: string[] = [];
  if (request.dateFrom) dates.push(formatDate(request.dateFrom));
  if (request.dateTo) dates.push(formatDate(request.dateTo));
  return {
    id: request.id,
    kind: 'team',
    typeLabel: teamRequestTypeLabels[request.type] ?? request.type,
    dateLabel: dates.join(' - ') || '—',
    amountLabel: `${request.hours} ч`,
    status: request.status,
    comment: request.reason || request.comment || 'Без комментария',
    createdAt: request.createdAt,
    comparableDate: request.createdAt ?? request.dateFrom,
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
