import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Send } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DatePicker, Select, Textarea } from '../components/ui';
import { api } from '../shared/api';
import type { VacationType } from '../shared/types';
import { useDraftForm } from '../shared/hooks/useDraftForm';
import { hapticNotification, showAppToast } from '../shared/utils';
import { toDateInputValue } from '../shared/utils/date';

type FormErrors = Partial<Record<'startDate' | 'endDate' | 'vacationType', string>>;

const vacationTypes: Array<{ value: VacationType; label: string }> = [
  { value: 'ANNUAL', label: 'Ежегодный оплачиваемый' },
  { value: 'UNPAID', label: 'Без сохранения заработной платы' },
  { value: 'SICK_LEAVE', label: 'Больничный' },
  { value: 'OTHER', label: 'Другое' },
];

export function CreateVacationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = useMemo(() => toDateInputValue(), []);
  const [form, setForm, clearDraft] = useDraftForm('draft-vacation', {
    startDate: today,
    endDate: today,
    vacationType: 'ANNUAL' as VacationType,
    comment: '',
  });
  const { startDate, endDate, vacationType, comment } = form;
  const [errors, setErrors] = useState<FormErrors>({});

  const daysCount = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) {
      return 0;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }, [endDate, startDate]);

  const mutation = useMutation({
    mutationFn: api.createVacation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      hapticNotification('success');
      showAppToast('Заявка создана', 'Отпуск отправлен на согласование');
      clearDraft();
      navigate('/calendar');
    },
    onError: () => {
      hapticNotification('error');
      showAppToast('Не удалось создать заявку', 'Проверьте даты и попробуйте еще раз', 'error');
    },
  });

  const submit = useCallback(() => {
    const nextErrors = validate({ startDate, endDate, vacationType });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      hapticNotification('warning');
      return;
    }

    mutation.mutate({ startDate, endDate, vacationType, comment: comment.trim() || undefined });
  }, [comment, endDate, mutation, startDate, vacationType]);

  return (
    <div className="space-y-4">
      <Card className="app-gradient text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold opacity-80">Новая заявка</p>
            <h1 className="mt-1 text-3xl font-black">Отпуск</h1>
          </div>
          <CalendarDays size={38} />
        </div>
      </Card>

      <Card>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white">Создать отпуск</h2>
            <p className="mt-1 text-sm font-semibold text-[#7A8599]">
              {daysCount > 0 ? `${daysCount} дн.` : 'Выберите даты'}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <DatePicker
            label="Дата начала"
            value={startDate}
            error={errors.startDate}
            onChange={(e) => setForm({ startDate: e.target.value })}
          />
          <DatePicker
            label="Дата окончания"
            value={endDate}
            error={errors.endDate}
            onChange={(e) => setForm({ endDate: e.target.value })}
          />
          <Select
            label="Тип отпуска"
            value={vacationType}
            error={errors.vacationType}
            onChange={(e) => setForm({ vacationType: e.target.value as VacationType })}
          >
            {vacationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Комментарий"
            value={comment}
            placeholder="Можно оставить пустым"
            onChange={(e) => setForm({ comment: e.target.value })}
          />

          {mutation.isError && <p className="text-sm font-bold text-rose-500">Не удалось создать заявку. Попробуйте еще раз.</p>}

          <Button size="lg" onClick={submit} disabled={mutation.isPending}>
            <Send size={18} />
            {mutation.isPending ? 'Отправляем' : 'Отправить заявку'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function validate({
  startDate,
  endDate,
  vacationType,
}: {
  startDate: string;
  endDate: string;
  vacationType: VacationType;
}) {
  const errors: FormErrors = {};

  if (!startDate) {
    errors.startDate = 'Укажите дату начала';
  }

  if (!endDate) {
    errors.endDate = 'Укажите дату окончания';
  }

  if (startDate && endDate && endDate < startDate) {
    errors.endDate = 'Дата окончания не может быть раньше даты начала';
  }

  if (!vacationType) {
    errors.vacationType = 'Выберите тип отпуска';
  }

  return errors;
}
