import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, Clock3, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DatePicker, EmptyState, Input, Select, Textarea } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import { useDraftForm } from '../shared/hooks/useDraftForm';
import { hapticNotification, showAppToast } from '../shared/utils';
import { toDateInputValue } from '../shared/utils/date';

type FormErrors = Partial<Record<'date' | 'hours' | 'reason' | 'comment', string>>;

const reasons = ['Личные дела', 'Семейные обстоятельства', 'Переработка', 'Другое'];

export function CreateTimeOffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const availableHours = dashboard.balance.balanceHours;
  const [form, setForm, clearDraft] = useDraftForm('draft-timeoff', {
    date: toDateInputValue(),
    hours: 8,
    reason: reasons[0],
    comment: '',
  });
  const { date, hours, reason, comment } = form;
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [pendingDate, setPendingDate] = useState(toDateInputValue());

  const remainingAfterRequest = useMemo(() => Math.max(availableHours - (Number.isFinite(hours) ? hours : 0), 0), [availableHours, hours]);

  const singleMutation = useMutation({
    mutationFn: api.createTimeOff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['timeoff'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      hapticNotification('success');
      showAppToast('Заявка создана', 'Отгул отправлен на согласование');
      clearDraft();
      setIsSuccess(true);
    },
    onError: () => {
      hapticNotification('error');
      showAppToast('Не удалось создать заявку', 'Проверьте данные и попробуйте еще раз', 'error');
    },
  });

  const batchMutation = useMutation({
    mutationFn: api.createTimeOffBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['timeoff'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      hapticNotification('success');
      showAppToast(`Создано ${selectedDates.length} заявок`);
      clearDraft();
      setIsSuccess(true);
    },
    onError: (err: any) => {
      hapticNotification('error');
      showAppToast('Не удалось создать заявки', err?.message ?? 'Проверьте данные', 'error');
    },
  });

  const addDate = () => {
    if (pendingDate && !selectedDates.includes(pendingDate)) {
      setSelectedDates(prev => [...prev, pendingDate].sort());
    }
    setPendingDate(toDateInputValue());
  };

  const removeDate = (d: string) => {
    setSelectedDates(prev => prev.filter(x => x !== d));
  };

  useEffect(() => {
    if (!isSuccess) return;
    const timeout = window.setTimeout(() => navigate('/requests'), 1300);
    return () => window.clearTimeout(timeout);
  }, [isSuccess, navigate]);

  const submit = useCallback(() => {
    if (multiMode) {
      if (selectedDates.length === 0) {
        showAppToast('Добавьте хотя бы одну дату', undefined, 'error');
        return;
      }
      const totalHours = hours * selectedDates.length;
      if (totalHours > availableHours) {
        showAppToast(`Недостаточно баланса: нужно ${totalHours} ч, доступно ${availableHours} ч`, undefined, 'error');
        return;
      }
      batchMutation.mutate({ dates: selectedDates, hours, reason, comment: comment || undefined });
    } else {
      const nextErrors = validate({ date, hours, reason, comment, availableHours });
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        hapticNotification('warning');
        return;
      }
      singleMutation.mutate({ date, hours, reason, comment: comment || undefined });
    }
  }, [multiMode, selectedDates, hours, availableHours, batchMutation, date, reason, comment, singleMutation]);

  if (isSuccess) {
    return (
      <EmptyState
        title={multiMode ? 'Заявки созданы' : 'Заявка создана'}
        description="Перенаправляем в раздел заявок"
        action={<CheckCircle2 className="mx-auto text-emerald-500" size={32} />}
      />
    );
  }

  return (
    <>
      <Card className="app-gradient text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold opacity-80">Доступно</p>
            <p className="mt-1 text-4xl font-black">{availableHours} ч</p>
          </div>
          <Clock3 size={34} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Создать отгул</h2>
          <label className="flex items-center gap-2 text-[13px] text-white/50 cursor-pointer">
            <input type="checkbox" checked={multiMode} onChange={e => setMultiMode(e.target.checked)} className="rounded border-white/20" />
            Несколько дат
          </label>
        </div>

        <div className="grid gap-4">
          {multiMode ? (
            <>
              <div className="flex items-end gap-2">
                <DatePicker label="Добавить дату" value={pendingDate} onChange={e => setPendingDate(e.target.value)} />
                <Button size="sm" variant="secondary" onClick={addDate} disabled={!pendingDate}>
                  <Plus size={14} />
                </Button>
              </div>

              {selectedDates.length > 0 && (
                <div className="space-y-1">
                  {selectedDates.map(d => (
                    <div key={d} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="text-[14px] text-white/80">{d}</span>
                      <button onClick={() => removeDate(d)} className="text-rose-400 hover:text-rose-300">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <p className="text-[13px] text-white/40 pt-1">
                    Будет создано <b>{selectedDates.length}</b> заявок, итого <b>{selectedDates.length * hours} ч</b>
                  </p>
                </div>
              )}

              {selectedDates.length === 0 && (
                <p className="text-[13px] text-white/30">Нажмите + чтобы добавить даты</p>
              )}
            </>
          ) : (
            <DatePicker label="Дата" value={date} error={errors.date} onChange={(e) => setForm({ date: e.target.value })} />
          )}

          <Input
            label="Количество часов"
            type="number"
            min={1}
            max={availableHours}
            value={hours}
            error={errors.hours}
            hint={multiMode ? `На каждую дату по ${hours} ч` : `Останется после заявки: ${remainingAfterRequest} ч`}
            onChange={(e) => setForm({ hours: Number(e.target.value) })}
          />
          <Select label="Причина" value={reason} error={errors.reason} onChange={(e) => setForm({ reason: e.target.value })}>
            {reasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Textarea
            label="Комментарий"
            value={comment}
            maxLength={500}
            error={errors.comment}
            hint={`${comment.length}/500`}
            onChange={(e) => setForm({ comment: e.target.value })}
          />
          {(singleMutation.isError || batchMutation.isError) && (
            <p className="text-sm font-bold text-rose-500">Не удалось создать заявку. Попробуйте еще раз.</p>
          )}
          <Button size="lg" onClick={submit} disabled={singleMutation.isPending || batchMutation.isPending}>
            {singleMutation.isPending || batchMutation.isPending ? 'Отправляем' : 'Отправить на согласование'}
          </Button>
        </div>
      </Card>
    </>
  );
}

function validate({
  date,
  hours,
  reason,
  comment,
  availableHours,
}: {
  date: string;
  hours: number;
  reason: string;
  comment: string;
  availableHours: number;
}) {
  const errors: FormErrors = {};

  if (!date) {
    errors.date = 'Укажите дату';
  }

  if (!hours || hours <= 0) {
    errors.hours = 'Укажите количество часов';
  } else if (hours > availableHours) {
    errors.hours = 'Нельзя запросить больше доступного баланса';
  }

  if (!reason.trim()) {
    errors.reason = 'Выберите причину';
  }

  if (comment.length > 500) {
    errors.comment = 'Комментарий должен быть не длиннее 500 символов';
  }

  return errors;
}
