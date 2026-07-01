import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Clock, Plus,
  RefreshCw, Trash2, X, ExternalLink
} from 'lucide-react';
import { Button, Loader, EmptyState } from '../../components/ui';
import { api } from '../../shared/api';
import { showAppToast } from '../../shared/utils';
import { JiraIssuePicker } from './JiraIssuePicker';

const MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const shift    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < shift; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function heatColor(hours: number): string {
  if (hours <= 0) return 'bg-white/[0.03]';
  if (hours < 4)  return 'bg-blue-500/10';
  if (hours < 6)  return 'bg-blue-500/20';
  if (hours < 8)  return 'bg-blue-500/35';
  return 'bg-[#4C7DFF]/50';
}

function dayNumberColor(hours: number, isToday: boolean, isWeekend: boolean): string {
  if (isToday) return 'text-[#4C7DFF] font-bold';
  if (isWeekend) return 'text-white/25';
  if (hours > 0) return 'text-white/80';
  return 'text-white/40';
}

export function WorklogCalendarPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState<string>('');

  const calQuery = useQuery({
    queryKey: ['worklog', 'calendar', year, month],
    queryFn:  () => api.monthlyWorklog(year, month),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWorklog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worklog'] });
      showAppToast('Запись удалена');
    },
  });

  const retryMutation = useMutation({
    mutationFn: api.jiraRetryFailed,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['worklog'] });
      showAppToast(`Повторная синхронизация: ${data.retried} записей`);
    },
  });

  const dayData = useMemo(() => {
    const map = new Map<string, { totalHours: number; entries: any[] }>();
    for (const d of calQuery.data?.byDay ?? []) {
      map.set(d.date, d);
    }
    return map;
  }, [calQuery.data]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  function openLogModal(date: string) {
    setLogDate(date);
    setShowLogModal(true);
  }

  const selectedDayData = selectedDate ? dayData.get(selectedDate) : null;
  const todayStr = fmt(today);
  const data = calQuery.data;

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Календарь списаний</h1>
          <p className="text-[15px] text-white/40 mt-1">Visualize your time like Tempo</p>
        </div>
        <Button onClick={() => openLogModal(todayStr)}>
          <Plus size={16} className="mr-1" /> Списать время
        </Button>
      </div>

      {(data?.failedSync ?? 0) > 0 && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] text-rose-400 font-semibold">
            {data!.failedSync} запись(-ей) не синхронизированы с Jira
          </span>
          <Button size="sm" variant="secondary" onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}>
            <RefreshCw size={14} className="mr-1" />
            {retryMutation.isPending ? 'Синхронизируем...' : 'Повторить'}
          </Button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="enterprise-card p-5">
            <p className="text-[13px] font-medium text-white/45 mb-1">Всего за месяц</p>
            <p className="text-[32px] font-bold text-white leading-none">{data.totalHours}<span className="text-[16px] text-white/40 ml-1">ч</span></p>
          </div>
          <div className="enterprise-card p-5">
            <p className="text-[13px] font-medium text-white/45 mb-1">Дней с работой</p>
            <p className="text-[32px] font-bold text-white leading-none">{data.daysWorked}</p>
          </div>
          <div className="enterprise-card p-5">
            <p className="text-[13px] font-medium text-white/45 mb-1">Среднее в день</p>
            <p className="text-[32px] font-bold text-white leading-none">
              {data.daysWorked > 0 ? (data.totalHours / data.daysWorked).toFixed(1) : '0'}<span className="text-[16px] text-white/40 ml-1">ч</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">

        <div className="enterprise-card p-6">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/80 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-[18px] font-bold text-white">
              {MONTHS_RU[month - 1]} {year}
            </h2>
            <button onClick={nextMonth}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/80 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_RU.map((d, i) => (
              <div key={d}
                className={`text-center text-[12px] font-semibold pb-2 ${i >= 5 ? 'text-white/25' : 'text-white/40'}`}>
                {d}
              </div>
            ))}
          </div>

          {calQuery.isLoading
            ? <Loader label="Загружаем списания..." />
            : (
              <div className="grid grid-cols-7 gap-1">
                {grid.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="aspect-square rounded-xl" />;
                  }

                  const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dayInfo  = dayData.get(dateStr);
                  const hours    = dayInfo?.totalHours ?? 0;
                  const isToday  = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const colIdx   = idx % 7;
                  const isWeekend = colIdx >= 5;
                  const hasFailed = dayInfo?.entries.some(e => e.syncStatus === 'FAILED');

                  return (
                    <div
                      key={dateStr}
                      role="button"
                      tabIndex={0}
                      aria-label={`${day} ${MONTHS_RU[month-1]}: ${hours}ч`}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      onKeyDown={e => e.key === 'Enter' && setSelectedDate(isSelected ? null : dateStr)}
                      className={[
                        'group relative aspect-square rounded-xl flex flex-col items-center justify-between',
                        'p-1.5 cursor-pointer transition-all select-none',
                        heatColor(hours),
                        isSelected ? 'ring-2 ring-[#4C7DFF]' : 'hover:ring-1 hover:ring-white/20',
                        isWeekend ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <span className={`text-[13px] leading-none ${dayNumberColor(hours, isToday, isWeekend)}`}>
                        {day}
                      </span>

                      {isToday && (
                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#4C7DFF]" />
                      )}

                      {hasFailed && (
                        <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-400" />
                      )}

                      {hours > 0 && (
                        <span className="text-[11px] font-bold text-[#4C7DFF]">{hours}ч</span>
                      )}

                      {hours === 0 && !isWeekend && (
                        <button
                          aria-label={`Списать время за ${day} ${MONTHS_RU[month-1]}`}
                          onClick={e => { e.stopPropagation(); openLogModal(dateStr); }}
                          className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.04]"
                        >
                          <Plus size={14} className="text-white/40" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          }

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
            <span className="text-[12px] text-white/30">Интенсивность:</span>
            <div className="flex items-center gap-1.5">
              {[
                { cls: 'bg-white/[0.03]',   label: '0ч' },
                { cls: 'bg-blue-500/10',    label: '<4ч' },
                { cls: 'bg-blue-500/20',    label: '<6ч' },
                { cls: 'bg-blue-500/35',    label: '<8ч' },
                { cls: 'bg-[#4C7DFF]/50',  label: '8+ч' },
              ].map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className={`h-4 w-4 rounded ${cls} border border-white/10`} />
                  <span className="text-[10px] text-white/30">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span className="text-[11px] text-white/30">Не синхронизировано с Jira</span>
            </div>
          </div>
        </div>

        <div className="enterprise-card p-5 sticky top-6 self-start">
          {!selectedDate ? (
            <EmptyState
              title="Выберите день"
              description="Кликните на любой день в календаре чтобы увидеть списания"
            />
          ) : (
            <DayPanel
              dateStr={selectedDate}
              dayData={selectedDayData}
              onAdd={() => openLogModal(selectedDate)}
              onDelete={id => deleteMutation.mutate(id)}
              isDeleting={deleteMutation.isPending}
            />
          )}
        </div>
      </div>

      {showLogModal && (
        <LogTimeModal
          defaultDate={logDate}
          onClose={() => setShowLogModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['worklog'] });
            setSelectedDate(logDate);
          }}
        />
      )}
    </div>
  );
}

function DayPanel({
  dateStr, dayData, onAdd, onDelete, isDeleting,
}: {
  dateStr: string;
  dayData: { totalHours: number; entries: any[] } | undefined;
  onAdd: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const date = new Date(dateStr + 'T00:00:00');
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-white">
            {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </h3>
          <p className="text-[13px] text-white/40">
            {date.toLocaleDateString('ru-RU', { weekday: 'long' })}
            {isWeekend && <span className="ml-1 text-amber-400/70">• выходной</span>}
          </p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-lg bg-[#4C7DFF]/15 px-3 py-1.5
                     text-[13px] font-semibold text-[#4C7DFF] hover:bg-[#4C7DFF]/25 transition-colors"
        >
          <Plus size={13} /> Списать
        </button>
      </div>

      {dayData && dayData.totalHours > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-[#4C7DFF]/10 px-3 py-2">
          <Clock size={14} className="text-[#4C7DFF]" />
          <span className="text-[14px] font-bold text-[#4C7DFF]">{dayData.totalHours}ч</span>
          <span className="text-[13px] text-white/40">суммарно за день</span>
        </div>
      )}

      {!dayData || dayData.entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-[14px] text-white/35">Нет списаний</p>
          <button onClick={onAdd}
            className="text-[13px] text-[#4C7DFF] hover:text-[#6B96FF] transition-colors">
            Добавить первую запись →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {dayData.entries.map((entry) => (
            <div key={entry.id} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {entry.jiraIssue ? (
                    <a
                      href={entry.jiraIssue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[13px] font-bold text-[#4C7DFF] hover:underline"
                    >
                      {entry.jiraIssue.issueKey}
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-[13px] font-bold text-white/50">{entry.issueKeyManual ?? '—'}</span>
                  )}
                  {entry.jiraIssue?.summary && (
                    <p className="text-[12px] text-white/55 mt-0.5 line-clamp-2">{entry.jiraIssue.summary}</p>
                  )}
                  {entry.comment && (
                    <p className="text-[12px] text-white/35 mt-1 italic">"{entry.comment}"</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[15px] font-bold text-white">{entry.hours}ч</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    entry.syncStatus === 'SYNCED'  ? 'bg-emerald-500/10 text-emerald-400'
                    : entry.syncStatus === 'FAILED'  ? 'bg-rose-500/10 text-rose-400'
                    : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {entry.syncStatus === 'SYNCED' ? 'В Jira' : entry.syncStatus === 'FAILED' ? 'Ошибка' : 'Ожидает'}
                  </span>
                </div>
              </div>

              {confirmDeleteId === entry.id ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[12px] text-white/40 flex-1">Удалить запись?</span>
                  <button
                    onClick={() => { onDelete(entry.id); setConfirmDeleteId(null); }}
                    disabled={isDeleting}
                    className="text-[12px] font-semibold text-rose-400 hover:text-rose-300"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-[12px] text-white/30 hover:text-white/60"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-white/20 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={11} /> удалить
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogTimeModal({
  defaultDate,
  onClose,
  onSuccess,
}: {
  defaultDate: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [manualKey, setManualKey] = useState('');
  const [date,    setDate]    = useState(defaultDate);
  const [hours,   setHours]   = useState('1');
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.createWorklog({
      jiraIssueId:     selectedIssue?.id,
      issueKeyManual:  !selectedIssue ? (manualKey || undefined) : undefined,
      date,
      hours:   Number(hours),
      comment: comment || undefined,
    }),
    onSuccess: () => {
      showAppToast('Время списано');
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      showAppToast(err?.message ?? 'Ошибка при создании записи', undefined, 'error');
    },
  });

  const isValid = (selectedIssue || manualKey.trim().length >= 2) && Number(hours) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#111A2E] border border-white/10 p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-white">Списать время</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70">
            <X size={18} />
          </button>
        </div>

        <JiraIssuePicker
          selected={selectedIssue}
          onSelect={setSelectedIssue}
          manualKey={manualKey}
          onManualKeyChange={setManualKey}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="field-shell">
            <span className="field-label">Дата</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="field-shell">
            <span className="field-label">Часы</span>
            <input
              type="number"
              step="0.5"
              min="0.1"
              max="24"
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="field-input"
            />
          </div>
        </div>

        <div className="field-shell">
          <span className="field-label">Комментарий (опционально)</span>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="Что именно делал..."
            className="field-input resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Отмена</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
            className="flex-1"
          >
            {mutation.isPending ? 'Сохраняем...' : 'Списать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
