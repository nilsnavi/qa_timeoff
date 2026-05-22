import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DatePicker, EmptyState, Input, Select, Textarea } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';
import { hapticNotification, showAppToast, useTelegramMainButton } from '../shared/utils';
import { toDateInputValue } from '../shared/utils/date';

type FormErrors = Partial<Record<'date' | 'hours' | 'reason' | 'comment', string>>;

const reasons = ['Личные дела', 'Семейные обстоятельства', 'Переработка', 'Другое'];

export function CreateTimeOffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const availableHours = dashboard.balance.balanceHours;
  const [date, setDate] = useState(toDateInputValue());
  const [hours, setHours] = useState(8);
  const [reason, setReason] = useState(reasons[0]);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSuccess, setIsSuccess] = useState(false);

  const remainingAfterRequest = useMemo(() => Math.max(availableHours - (Number.isFinite(hours) ? hours : 0), 0), [availableHours, hours]);

  const mutation = useMutation({
    mutationFn: api.createTimeOff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['timeoff'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      hapticNotification('success');
      showAppToast('Заявка создана', 'Отгул отправлен на согласование');
      setIsSuccess(true);
    },
    onError: () => {
      hapticNotification('error');
      showAppToast('Не удалось создать заявку', 'Проверьте данные и попробуйте еще раз', 'error');
    },
  });

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => navigate('/requests'), 1300);
    return () => window.clearTimeout(timeout);
  }, [isSuccess, navigate]);

  const submit = useCallback(() => {
    const nextErrors = validate({ date, hours, reason, comment, availableHours });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      hapticNotification('warning');
      return;
    }

    mutation.mutate({ date, hours, reason, comment: comment || undefined });
  }, [availableHours, comment, date, hours, mutation, reason]);

  useTelegramMainButton({
    text: mutation.isPending ? 'Отправляем...' : 'Отправить на согласование',
    visible: !isSuccess,
    disabled: mutation.isPending,
    loading: mutation.isPending,
    onClick: submit,
  });

  if (isSuccess) {
    return (
      <EmptyState
        title="Заявка создана"
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
        <h2 className="mb-4 text-lg font-black text-slate-950 dark:text-white">Создать отгул</h2>
        <div className="grid gap-4">
          <DatePicker label="Дата" value={date} error={errors.date} onChange={(event) => setDate(event.target.value)} />
          <Input
            label="Количество часов"
            type="number"
            min={1}
            max={availableHours}
            value={hours}
            error={errors.hours}
            hint={`Останется после заявки: ${remainingAfterRequest} ч`}
            onChange={(event) => setHours(Number(event.target.value))}
          />
          <Select label="Причина" value={reason} error={errors.reason} onChange={(event) => setReason(event.target.value)}>
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
            onChange={(event) => setComment(event.target.value)}
          />
          {mutation.isError && <p className="text-sm font-bold text-rose-500">Не удалось создать заявку. Попробуйте еще раз.</p>}
          <Button size="lg" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Отправляем' : 'Отправить на согласование'}
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
