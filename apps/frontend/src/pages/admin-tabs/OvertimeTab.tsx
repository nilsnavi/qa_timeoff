import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CustomSelect, EmptyState, ErrorState, Field, Loader, Modal } from '../../components/ui';
import type { SelectOption } from '../../components/ui/CustomSelect';
import { api } from '../../shared/api';
import type { OvertimeCalendarEntry } from '../../shared/types';
import { clsx } from 'clsx';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getMonthDays(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }
  return days;
}

export function OvertimeTab() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [addOpen, setAddOpen] = useState(false);
  const [detailsUserId, setDetailsUserId] = useState('');
  const [overtimeUserId, setOvertimeUserId] = useState('');
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [overtimeDate, setOvertimeDate] = useState(() => now.toISOString().slice(0, 10));
  const [overtimeReason, setOvertimeReason] = useState('');
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calUserId, setCalUserId] = useState('');

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users });
  const users = usersQuery.data ?? [];

  const userOptions: SelectOption[] = [
    { value: '', label: 'Все' },
    ...users.map(u => ({ value: u.id, label: u.fullName })),
  ];

  const userOptionsWithDash: SelectOption[] = [
    { value: '', label: '—' },
    ...users.map(u => ({ value: u.id, label: u.fullName })),
  ];

  const overtimeQuery = useQuery({
    queryKey: ['admin', 'overtime', 'all'],
    queryFn: () => api.overtimeReport({ startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10) }),
  });

  const userOvertimeQuery = useQuery({
    queryKey: ['admin', 'overtime', 'user', detailsUserId],
    queryFn: () => api.userOvertime(detailsUserId),
    enabled: !!detailsUserId,
  });

  const calQuery = useQuery({
    queryKey: ['admin', 'overtime', 'calendar', calYear, calMonth, calUserId],
    queryFn: () => api.overtimeCalendar({ year: calYear, month: calMonth, userId: calUserId || undefined }),
  });

  const addMutation = useMutation({
    mutationFn: () => api.addOvertime({ userId: overtimeUserId, hours: overtimeHours, date: overtimeDate, reason: overtimeReason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'overtime'] }); setAddOpen(false); setOvertimeHours(0); setOvertimeReason(''); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelOvertime(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'overtime'] }); queryClient.invalidateQueries({ queryKey: ['admin', 'overtime', 'user'] }); },
  });

  const report = overtimeQuery.data;
  const allOvertimeEntries = report?.departments?.flatMap(d => d.users) ?? [];
  const userRecords = userOvertimeQuery.data ?? [];
  const calData = calQuery.data ?? [];

  const calDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);

  const calByDate = useMemo(() => {
    const map = new Map<string, OvertimeCalendarEntry[]>();
    for (const entry of calData) {
      const existing = map.get(entry.date) ?? [];
      existing.push(entry);
      map.set(entry.date, existing);
    }
    return map;
  }, [calData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-white/40 uppercase">Овертайм {report?.period ? `(${report.period.start} — ${report.period.end})` : ''}</span>
        <Button size="sm" variant="secondary" onClick={() => { setOvertimeUserId(''); setOvertimeHours(0); setOvertimeReason(''); setAddOpen(true); }}>
          <Clock size={14} className="mr-1" />Добавить
        </Button>
      </div>

      {overtimeQuery.isLoading && <Loader />}
      {overtimeQuery.isError && <ErrorState title="Ошибка загрузки" />}

      {report && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <span className="block text-[12px] font-bold text-white/30 uppercase">Всего часов</span>
            <span className="text-2xl font-bold text-white">{report.totalOvertimeHours}</span>
          </Card>
          {report.topEmployees?.slice(0, 3).map((emp: any) => (
            <Card key={emp.userId}>
              <span className="block text-[12px] font-bold text-white/30 uppercase">Топ: {emp.fullName}</span>
              <span className="text-lg font-bold text-amber-400">{emp.totalHours} ч</span>
            </Card>
          ))}
        </div>
      )}

      {report?.departments?.map((dept: any) => (
        <div key={dept.department}>
          <span className="text-[13px] font-bold text-white/40 uppercase mb-2 block">{dept.department} — всего {dept.departmentTotal} ч</span>
          <div className="space-y-2">
            {dept.users.map((u: any) => (
              <Card key={u.userId}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-white">{u.fullName}</span>
                  <span className="text-[15px] font-semibold text-amber-400">{u.totalHours} ч</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {!overtimeQuery.isLoading && !overtimeQuery.isError && allOvertimeEntries.length === 0 && (
        <EmptyState title="Нет данных об овертайме" description="Добавьте первую запись" />
      )}

      {/* ── Calendar view ──────────────────────────────────────────────── */}

      <div className="border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-bold text-white/40 uppercase">Календарь овертайма</span>
          <div className="flex items-center gap-2">
            <div className="field-shell">
              <span className="field-label">Сотрудник</span>
              <CustomSelect
                value={calUserId}
                onChange={setCalUserId}
                options={userOptions}
                placeholder="Все"
                small
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} className="!min-h-0 h-7 w-7 !p-0">
              <ChevronLeft size={14} />
            </Button>
            <span className="text-[14px] font-semibold text-white/70 w-20 text-center">{calMonth}.{calYear}</span>
            <Button size="sm" variant="ghost" onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} className="!min-h-0 h-7 w-7 !p-0">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        {calQuery.isLoading && <Loader />}

        {!calQuery.isLoading && calData.length > 0 && (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-white/30 mb-1">
              {DAYS.map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: new Date(calYear, calMonth - 1, 1).getDay() === 0 ? 6 : new Date(calYear, calMonth - 1, 1).getDay() - 1 }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {calDays.map(day => {
                const dayStr = day.toISOString().slice(0, 10);
                const entries = calByDate.get(dayStr) ?? [];
                const total = entries.reduce((s, e) => s + e.totalHours, 0);
                const isToday = day.toDateString() === now.toDateString();
                return (
                  <div key={dayStr} className={clsx('rounded-lg p-1.5 text-center min-h-[48px] transition', isToday ? 'ring-1 ring-[#4C7DFF]/50 bg-white/[0.06]' : 'bg-white/[0.03]')}>
                    <span className={clsx('text-[11px] font-bold', isToday ? 'text-[#4C7DFF]' : 'text-white/50')}>{day.getDate()}</span>
                    {total > 0 && (
                      <div className="mt-0.5 rounded bg-amber-500/20 px-1 py-0.5">
                        <span className="text-[10px] font-bold text-amber-400">{total} ч</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 space-y-1">
              {calData.map(entry => (
                <div key={`${entry.date}-${entry.userId}`} className="flex items-center justify-between text-[12px] text-white/60">
                  <span>{entry.date}</span>
                  <span className="font-semibold text-white/80">{entry.userName}</span>
                  <span className="text-amber-400">{entry.totalHours} ч</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!calQuery.isLoading && calData.length === 0 && (
          <span className="text-[13px] text-white/30">Нет данных за этот месяц</span>
        )}
      </div>

      {/* ── Individual records with cancel ──────────────────────────────── */}

      <div className="border-t border-white/[0.06] pt-4">
        <span className="text-[13px] font-bold text-white/40 uppercase mb-3 block">Записи по сотруднику</span>
        <div className="flex items-center gap-3 mb-3">
          <div className="field-shell">
            <span className="field-label">Сотрудник</span>
            <CustomSelect
              value={detailsUserId}
              onChange={setDetailsUserId}
              options={userOptionsWithDash}
              placeholder="—"
            />
          </div>
        </div>

        {userOvertimeQuery.isLoading && <Loader />}

        {detailsUserId && !userOvertimeQuery.isLoading && userRecords.length === 0 && (
          <EmptyState title="Нет записей" description="У сотрудника нет овертайма" />
        )}

        {userRecords.length > 0 && (
          <div className="space-y-2">
            {userRecords.map((rec: any) => (
              <Card key={rec.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[14px] text-white">{new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                    <Badge tone="warning">{rec.hours} ч</Badge>
                    <span className="text-[13px] text-white/50">{rec.reason}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/30">{rec.createdBy?.fullName ?? ''}</span>
                    <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('Отменить запись овертайма?')) cancelMutation.mutate(rec.id); }} className="!min-h-0 h-7 w-7 !p-0 text-rose-400">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <Modal open title="Добавить овертайм" onClose={() => setAddOpen(false)}
          footer={<div className="flex gap-2"><Button variant="secondary" onClick={() => setAddOpen(false)}>Отмена</Button><Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !overtimeUserId}>Добавить</Button></div>}>
          <div className="space-y-4">
            <div className="field-shell">
              <span className="field-label">Сотрудник</span>
              <CustomSelect
                value={overtimeUserId}
                onChange={setOvertimeUserId}
                options={userOptionsWithDash}
                placeholder="—"
              />
            </div>
            <Field label="Часы" type="number" value={String(overtimeHours)} onChange={e => setOvertimeHours(Number(e.target.value))} />
            <Field label="Дата" type="date" value={overtimeDate} onChange={e => setOvertimeDate(e.target.value)} />
            <Field label="Причина" value={overtimeReason} onChange={e => setOvertimeReason(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
