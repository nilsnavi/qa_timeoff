import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { Button, Input, Select, Textarea } from '../ui';

const REQUEST_TYPES = [
  { value: 'TIME_OFF', label: 'Отгул' },
  { value: 'VACATION', label: 'Отпуск' },
] as const;

const REASONS = [
  { value: 'Личные дела', label: 'Личные дела' },
  { value: 'Семейные обстоятельства', label: 'Семейные обстоятельства' },
  { value: 'Медицинские причины', label: 'Медицинские причины' },
  { value: 'Другое', label: 'Другое' },
] as const;

export function CreateRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'TIME_OFF' | 'VACATION'>('TIME_OFF');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setType('TIME_OFF');
      setDateFrom('');
      setDateTo('');
      setHours('');
      setReason('');
      setComment('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (dateFrom && dateTo && dateFrom !== dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const diffDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      setHours(String(diffDays * 8));
    }
  }, [dateFrom, dateTo]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createLeaveRequest({
        type,
        dateFrom,
        dateTo: dateTo || undefined,
        hours: Number(hours),
        reason,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const isValid = type && dateFrom && hours && reason && Number(hours) > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 backdrop-blur-sm sm:place-items-center">
      <section className="enterprise-card w-full max-w-md p-4 animate-slideUp">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/30">Новая заявка</p>
            <h2 className="text-sm font-bold text-white">Создание заявки на отсутствие</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </Button>
        </div>

        <div className="grid gap-3">
          <Select
            label="Тип заявки"
            value={type}
            onChange={(e) => setType(e.target.value as 'TIME_OFF' | 'VACATION')}
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
          <Input
            label="Дата начала"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="Дата окончания"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          </div>

          <Input
            label="Количество часов"
            type="number"
            min={1}
            max={176}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            hint={dateFrom && dateTo && dateFrom !== dateTo ? 'Автоматически рассчитано' : undefined}
          />

          <Select
            label="Причина"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="" disabled>Выберите причину</option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>

          <Textarea
            label="Комментарий (необязательно)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            hint={`${comment.length}/500`}
          />

          {error && (
            <div className="rounded-[10px] bg-rose-950/300/10 p-3 text-xs font-medium text-rose-400">
              {error}
            </div>
          )}
        </div>

        <div className="mt-4">
          <Button
            className="w-full"
            disabled={!isValid || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Отправка...' : 'Отправить на согласование'}
          </Button>
        </div>
      </section>
    </div>
  );
}
