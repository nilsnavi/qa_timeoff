import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, ErrorState, Loader, Modal, Textarea } from '../components/ui';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import type { TimeOffRequest, VacationRequest } from '../shared/types';
import { getStatusLabel, getVacationTypeLabel } from '../shared/utils';
import { DataTable, type Column, type SortDirection } from '../components/dashboard-v2/DataTable';
import { clsx } from 'clsx';

type RequestKind = 'timeoff' | 'vacation';

type RequestRow = {
  id: string;
  kind: RequestKind;
  employeeName: string;
  typeLabel: string;
  date: string;
  amountLabel: string;
  reason: string;
  status: TimeOffRequest['status'];
  createdAt?: string;
  approverComment?: string;
  raw: TimeOffRequest | VacationRequest;
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-white/[0.04] text-white/40',
  PENDING: 'bg-amber-500/10 text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-400',
  REJECTED: 'bg-rose-950/300/10 text-rose-400',
  CANCELLED: 'bg-white/[0.02] text-white/20',
};

function mapToRow(r: TimeOffRequest, kind: 'timeoff'): RequestRow {
  return {
    id: r.id, kind,
    employeeName: ('user' in r ? (r as any).user?.fullName : '') || '',
    typeLabel: 'Отгул',
    date: r.date?.slice(0, 10) ?? '',
    amountLabel: `${r.hours}ч`,
    reason: r.reason ?? '',
    status: r.status,
    createdAt: r.createdAt,
    approverComment: r.comment,
    raw: r,
  };
}

function mapVacationToRow(v: VacationRequest): RequestRow {
  return {
    id: v.id, kind: 'vacation',
    employeeName: ('user' in v ? (v as any).user?.fullName : '') || '',
    typeLabel: getVacationTypeLabel(v.vacationType),
    date: `${v.startDate?.slice(0, 10) ?? ''} → ${v.endDate?.slice(0, 10) ?? ''}`,
    amountLabel: `${v.daysCount}дн`,
    reason: v.comment ?? '',
    status: v.status,
    createdAt: v.createdAt,
    approverComment: v.comment,
    raw: v,
  };
}

export function RequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canReview = user?.role === 'LEAD' || user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const hasToken = !!localStorage.getItem('qa-timeoff-token');
  const [rejectTarget, setRejectTarget] = useState<RequestRow | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');
  const pageSize = 15;

  const myTimeOffQuery = useQuery({ queryKey: ['timeoff', 'my'], queryFn: api.myTimeOff, enabled: hasToken && !canReview });
  const myVacationsQuery = useQuery({ queryKey: ['vacation', 'my'], queryFn: api.myVacations, enabled: hasToken && !canReview });
  const pendingTimeOffQuery = useQuery({ queryKey: ['timeoff', 'pending'], queryFn: api.pendingTimeOff, enabled: hasToken && canReview });
  const pendingVacationsQuery = useQuery({ queryKey: ['vacation', 'pending'], queryFn: api.pendingVacations, enabled: hasToken && canReview });

  const isLoading = myTimeOffQuery.isLoading || myVacationsQuery.isLoading || pendingTimeOffQuery.isLoading || pendingVacationsQuery.isLoading;
  const isError = myTimeOffQuery.isError || myVacationsQuery.isError || pendingTimeOffQuery.isError || pendingVacationsQuery.isError;

  const allRows = useMemo(() => {
    const rows: RequestRow[] = [];
    if (canReview) {
      for (const r of pendingTimeOffQuery.data ?? []) rows.push(mapToRow(r, 'timeoff'));
      for (const v of pendingVacationsQuery.data ?? []) rows.push(mapVacationToRow(v));
    } else {
      for (const r of myTimeOffQuery.data ?? []) rows.push(mapToRow(r, 'timeoff'));
      for (const v of myVacationsQuery.data ?? []) rows.push(mapVacationToRow(v));
    }
    return rows;
  }, [canReview, myTimeOffQuery.data, myVacationsQuery.data, pendingTimeOffQuery.data, pendingVacationsQuery.data]);

  const filtered = useMemo(() => {
    let result = allRows;
    if (filter !== 'ALL') result = result.filter(r => r.status === filter);
    return result;
  }, [allRows, filter]);

  const counts = useMemo(() => ({
    ALL: allRows.length,
    PENDING: allRows.filter(r => r.status === 'PENDING').length,
    APPROVED: allRows.filter(r => r.status === 'APPROVED').length,
    REJECTED: allRows.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  }), [allRows]);

  const filterTabs = useMemo(() => {
    const tabs: Array<{ value: 'ALL' | 'PENDING' | 'APPROVED'; label: string }> = [
      { value: 'ALL', label: `Все (${counts.ALL})` },
      { value: 'PENDING', label: `Ожидают (${counts.PENDING})` },
    ];
    if (!canReview) tabs.push({ value: 'APPROVED', label: `Одобрены (${counts.APPROVED})` });
    return tabs;
  }, [counts, canReview]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortKey] ?? '';
      const bVal = (b as any)[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const paginated = useMemo(() => {
    return sorted.slice((page - 1) * pageSize, page * pageSize);
  }, [sorted, page]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const approveTimeOff = useMutation({ mutationFn: api.approveTimeOff, onSuccess: () => queryClient.invalidateQueries() });
  const rejectTimeOff = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => api.rejectTimeOff(id, comment),
    onSuccess: () => { queryClient.invalidateQueries(); setRejectTarget(null); setRejectComment(''); },
  });

  const handleApprove = (row: RequestRow) => {
    if (!window.confirm(`Одобрить ${row.typeLabel} для ${row.employeeName}?`)) return;
    if (row.kind === 'vacation') api.approveVacation(row.id).then(() => queryClient.invalidateQueries()).catch(() => {});
    else approveTimeOff.mutate(row.id);
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectTimeOff.mutate({ id: rejectTarget.id, comment: rejectComment || undefined });
  };

  const columns: Column<RequestRow>[] = [
    { key: 'employeeName', header: 'Сотрудник', width: '20%', sortable: true, render: (r) => <span className="font-semibold text-white/90">{r.employeeName || '—'}</span> },
    { key: 'typeLabel', header: 'Тип', width: '12%', sortable: true, render: (r) => <span className="text-white/60">{r.typeLabel}</span> },
    { key: 'date', header: 'Дата', width: '22%', sortable: true, render: (r) => <span className="text-white/60 text-[14px] font-mono">{r.date}</span> },
    { key: 'amountLabel', header: 'Кол-во', width: '8%', align: 'right', sortable: true, render: (r) => <span className="font-semibold text-white/70">{r.amountLabel}</span> },
    { key: 'reason', header: 'Причина', width: '18%', render: (r) => <span className="text-white/50 truncate max-w-[180px] block">{r.reason || '—'}</span> },
    { key: 'status', header: 'Статус', width: '10%', sortable: true, align: 'center',
      render: (r) => <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-[14px] font-bold uppercase tracking-wider', statusClasses[r.status])}>{getStatusLabel(r.status)}</span> },
    { key: 'actions', header: '', width: '10%', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {canReview && r.status === 'PENDING' && (
            <>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleApprove(r); }} className="!min-h-0 h-7 w-7 !p-0 text-emerald-400 hover:text-emerald-300">
                <Check size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setRejectTarget(r); }} className="!min-h-0 h-7 w-7 !p-0 text-rose-400 hover:text-rose-300">
                <X size={14} />
              </Button>
            </>
          )}
          {!canReview && r.status === 'PENDING' && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (window.confirm('Отменить заявку?')) { const invalidate = () => { queryClient.invalidateQueries(); }; if (r.kind === 'vacation') { api.cancelVacation(r.id).then(invalidate); } else { api.cancelTimeOff(r.id).then(invalidate); } } }} className="!min-h-0 h-7 !px-2 text-[13px] text-rose-400">
              Отменить
            </Button>
          )}
          <Clock3 size={12} className="text-white/15" />
        </div>
      ),
    },
  ];

  if (isLoading) return <Loader label="Загрузка заявок" />;
  if (isError) return <ErrorState title="Ошибка загрузки" description="Не удалось загрузить заявки." onRetry={() => queryClient.invalidateQueries()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white">{canReview ? 'Заявки команды' : 'Мои заявки'}</h1>
          <p className="text-[15px] text-white/40 mt-1">{sorted.length} заявок</p>
        </div>
        <div className="flex items-center gap-2">
          {filterTabs.map(({ value, label }) => (
            <button key={value} onClick={() => { setFilter(value); setPage(1); }}
              className={clsx('rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors',
                filter === value ? 'bg-[#4C7DFF]/15 text-[#4C7DFF]' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginated}
        keyField="id"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        page={page}
        total={sorted.length}
        pageSize={pageSize}
        onPageChange={setPage}
        emptyMessage="Нет заявок"
        loading={false}
      />

      {rejectTarget && (
        <Modal open={!!rejectTarget} title="Отклонить заявку" onClose={() => { setRejectTarget(null); setRejectComment(''); }}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectComment(''); }}>Отмена</Button>
              <Button variant="danger" onClick={handleReject} disabled={rejectTimeOff.isPending}>{rejectTimeOff.isPending ? 'Отклоняется...' : 'Отклонить'}</Button>
            </div>
          }>
          <div className="space-y-3">
            <p className="text-[15px] text-white/60">{rejectTarget.employeeName} — {rejectTarget.typeLabel}</p>
            <Textarea label="Комментарий" placeholder="Причина отклонения..." value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={3} />
          </div>
        </Modal>
      )}
    </div>
  );
}
