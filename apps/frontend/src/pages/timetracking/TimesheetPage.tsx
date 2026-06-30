import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Loader } from '../../components/ui';
import { api } from '../../shared/api';
import { showAppToast } from '../../shared/utils';
import { JiraIssuePicker } from './JiraIssuePicker';

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TimesheetPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => fmt(getMonday(new Date())));
  const [showForm, setShowForm] = useState(false);

  const weekQuery = useQuery({
    queryKey: ['worklog', 'weekly', weekStart],
    queryFn: () => api.weeklyWorklog(weekStart),
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
      showAppToast(`Повторная синхронизация: ${data.retried} записей`);
      queryClient.invalidateQueries({ queryKey: ['worklog'] });
    },
  });

  function shiftWeek(days: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    setWeekStart(fmt(d));
  }

  const data = weekQuery.data;
  const hasFailedSync = data?.entries?.some((e: any) => e.syncStatus === 'FAILED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-white">Таймшит</h1>
          <p className="text-[15px] text-white/40 mt-1">Списание рабочего времени на задачи Jira</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1" /> Списать время
        </Button>
      </div>

      {hasFailedSync && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] text-rose-400 font-semibold">
            Есть записи, не синхронизированные с Jira
          </span>
          <Button size="sm" variant="secondary" onClick={() => retryMutation.mutate()}>
            <RefreshCw size={14} className="mr-1" /> Повторить
          </Button>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftWeek(-7)} className="text-white/40 hover:text-white/70">
            <ChevronLeft size={18} />
          </button>
          <span className="text-[15px] font-semibold text-white">
            Неделя с {new Date(weekStart).toLocaleDateString('ru-RU')}
          </span>
          <button onClick={() => shiftWeek(7)} className="text-white/40 hover:text-white/70">
            <ChevronRight size={18} />
          </button>
        </div>

        {weekQuery.isLoading && <Loader />}

        {data && (
          <>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {data.byDay.map((d: any) => (
                <div key={d.date} className="rounded-lg bg-white/[0.04] p-2 text-center">
                  <p className="text-[11px] text-white/30">{new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short' })}</p>
                  <p className="text-[16px] font-bold text-white">{d.hours}ч</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3 pt-3 border-t border-white/[0.06]">
              <span className="text-[14px] font-semibold text-white/60">Итого за неделю</span>
              <span className="text-[20px] font-bold text-[#4C7DFF]">{data.totalHours}ч</span>
            </div>

            {data.entries.length === 0 ? (
              <EmptyState title="Нет списаний за эту неделю" description="Нажмите «Списать время» чтобы добавить первую запись" />
            ) : (
              <div className="space-y-2">
                {data.entries.map((entry: any) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.jiraIssue ? (
                          <a href={entry.jiraIssue.url} target="_blank" rel="noreferrer"
                             className="text-[13px] font-bold text-[#4C7DFF] hover:underline">
                            {entry.jiraIssue.issueKey}
                          </a>
                        ) : (
                          <span className="text-[13px] font-bold text-white/50">{entry.issueKeyManual}</span>
                        )}
                        <span className="text-[13px] text-white/60 truncate">{entry.jiraIssue?.summary}</span>
                      </div>
                      {entry.comment && <p className="text-[12px] text-white/35 mt-0.5">{entry.comment}</p>}
                      <p className="text-[12px] text-white/30 mt-0.5">
                        {new Date(entry.date).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <span className="text-[15px] font-bold text-white shrink-0">{entry.hours}ч</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      entry.syncStatus === 'SYNCED' ? 'bg-emerald-500/10 text-emerald-400'
                      : entry.syncStatus === 'FAILED' ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {entry.syncStatus === 'SYNCED' ? 'В Jira' : entry.syncStatus === 'FAILED' ? 'Ошибка' : 'Ожидает'}
                    </span>
                    <button onClick={() => deleteMutation.mutate(entry.id)} className="text-white/20 hover:text-rose-400 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {showForm && <LogTimeModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function LogTimeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [manualKey, setManualKey] = useState('');
  const [date, setDate] = useState(fmt(new Date()));
  const [hours, setHours] = useState('1');
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.createWorklog({
      jiraIssueId: selectedIssue?.id,
      issueKeyManual: !selectedIssue ? manualKey : undefined,
      date,
      hours: Number(hours),
      comment: comment || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worklog'] });
      showAppToast('Время списано');
      onClose();
    },
    onError: (err: any) => showAppToast(err.message ?? 'Ошибка', undefined, 'error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#111A2E] border border-white/10 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-[18px] font-bold text-white">Списать время</h2>

        <JiraIssuePicker
          selected={selectedIssue}
          onSelect={setSelectedIssue}
          manualKey={manualKey}
          onManualKeyChange={setManualKey}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="field-shell">
            <span className="field-label">Дата</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="field-input" />
          </div>
          <div className="field-shell">
            <span className="field-label">Часы</span>
            <input type="number" step="0.5" min="0.1" max="24" value={hours} onChange={e => setHours(e.target.value)} className="field-input" />
          </div>
        </div>

        <div className="field-shell">
          <span className="field-label">Комментарий (опционально)</span>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="field-input" />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Отмена</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
            {mutation.isPending ? 'Сохраняем...' : 'Списать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
