import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Check, ChevronDown, Clock,
  RefreshCcw, Search, Upload, Users, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../shared/api';
import { useDashboard } from '../../shared/hooks/useDashboard';
import { showAppToast } from '../../shared/utils';
import { Button } from '../ui';

const REQUEST_TYPES = [
  { value: 'VACATION', label: 'Отпуск', description: 'Ежегодный оплачиваемый или дополнительный отпуск' },
  { value: 'TIME_OFF', label: 'Отгул', description: 'Краткосрочное отсутствие на несколько часов или дней' },
  { value: 'OVERWORK', label: 'Переработка', description: 'Компенсация за ранее отработанное сверхурочное время' },
  { value: 'OVERTIME', label: 'Сверхурочные', description: 'Работа за пределами нормального рабочего времени' },
  { value: 'REMOTE_WORK', label: 'Удалённая работа', description: 'Выполнение обязанностей вне офиса' },
  { value: 'OTHER', label: 'Прочее', description: 'Иной тип отсутствия или активности' },
] as const;

type FieldError = { field: string; message: string };

export function CreateTeamRequestModal({
  onClose,
  onSuccess,
  preselectedUserId,
  preselectedTeamId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  preselectedUserId?: string;
  preselectedTeamId?: string;
}) {
  const queryClient = useQueryClient();
  const { dashboard } = useDashboard();
  const currentUser = dashboard.user;
  const isAdminManager = ['ADMIN', 'MANAGER', 'LEAD'].includes(currentUser.role);

  const [type, setType] = useState<string>('VACATION');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hours, setHours] = useState('8');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(preselectedUserId ?? currentUser.id);
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId ?? currentUser.teamId ?? '');
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isReprocess, setIsReprocess] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: api.users,
    enabled: isAdminManager,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.teams(),
    staleTime: 5 * 60 * 1000,
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!userSearch.trim()) return users.slice(0, 10);
    const q = userSearch.toLowerCase();
    return users.filter(u => u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)).slice(0, 10);
  }, [users, userSearch]);

  const selectedUser = useMemo(() => users?.find(u => u.id === selectedUserId), [users, selectedUserId]);

  const approvers = useMemo(() => {
    if (!users) return [];
    const teamUsers = selectedTeamId ? users.filter(u => u.teamId === selectedTeamId) : users;
    return teamUsers.filter(u => ['LEAD', 'MANAGER', 'ADMIN'].includes(u.role) && u.id !== selectedUserId).slice(0, 3);
  }, [users, selectedTeamId, selectedUserId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (type === 'VACATION' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const diffDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      setHours(String(diffDays * 8));
    }
  }, [type, dateFrom, dateTo]);

  const validate = useCallback((): FieldError[] => {
    const errs: FieldError[] = [];
    if (!type) errs.push({ field: 'type', message: 'Выберите тип заявки' });
    if (!dateFrom) errs.push({ field: 'dateFrom', message: 'Укажите дату начала' });
    if (dateFrom && dateTo && new Date(dateTo) < new Date(dateFrom))
      errs.push({ field: 'dateTo', message: 'Дата окончания не может быть раньше даты начала' });
    if (!hours || Number(hours) <= 0) errs.push({ field: 'hours', message: 'Укажите количество часов' });
    if (Number(hours) > 240) errs.push({ field: 'hours', message: 'Не более 240 часов' });
    if (!reason.trim()) errs.push({ field: 'reason', message: 'Укажите причину' });
    if (isReprocess && type !== 'OVERWORK' && type !== 'OVERTIME')
      errs.push({ field: 'type', message: 'Переработка доступна только для типов «Переработка» и «Сверхурочные»' });
    return errs;
  }, [type, dateFrom, dateTo, hours, reason, isReprocess]);

  const fieldError = (field: string) => errors.find(e => e.field === field)?.message;

  const createMutation = useMutation({
    mutationFn: () => api.createTeamRequest({
      type,
      dateFrom,
      dateTo: dateTo || undefined,
      hours: Number(hours),
      reason,
      comment: comment || undefined,
      employeeId: selectedUserId !== currentUser.id ? selectedUserId : undefined,
      teamId: selectedTeamId || undefined,
    }),
    onSuccess: () => {
      showAppToast('Заявка создана');
      queryClient.invalidateQueries({ queryKey: ['team-requests'] });
      onSuccess();
    },
    onError: (err: any) => showAppToast(err?.message ?? 'Ошибка при создании заявки', undefined, 'error'),
  });

  const handleSubmit = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    createMutation.mutate();
  };

  const selectedTypeMeta = REQUEST_TYPES.find(t => t.value === type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div
        className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0F1829] border border-white/[0.08]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0F1829] px-6 py-4 border-b border-white/[0.05] rounded-t-2xl">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4C7DFF]">Заявки</p>
            <h2 className="text-[18px] font-bold text-white">{isReprocess ? 'Переработка заявки' : 'Создать заявку'}</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Reprocess toggle */}
          {!isReprocess && (
            <button
              onClick={() => setIsReprocess(true)}
              className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/15 px-4 py-2.5 text-[13px] font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors"
            >
              <RefreshCcw size={14} /> Создать переработку
            </button>
          )}
          {isReprocess && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/15 p-3 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-amber-400">Режим переработки</p>
                <p className="text-[12px] text-amber-400/60 mt-0.5">Будет создана заявка со статусом «На согласовании». Доступно для типов «Переработка» и «Сверхурочные».</p>
              </div>
            </div>
          )}

          {/* Employee selector (admin only) */}
          {isAdminManager && (
            <div className="field-shell">
              <span className="field-label">Сотрудник</span>
              <div className="relative" ref={userDropdownRef}>
                <div
                  onClick={() => setShowUserDropdown(v => !v)}
                  className="flex items-center justify-between gap-2 cursor-pointer rounded-[10px] bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 hover:border-white/[0.12] transition-colors"
                >
                  {selectedUser ? (
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[#4C7DFF]/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-[#4C7DFF]">
                          {selectedUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-white">{selectedUser.fullName}</p>
                        <p className="text-[11px] text-white/30">{selectedUser.position ?? selectedUser.email}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[13px] text-white/25">Выберите сотрудника...</span>
                  )}
                  <ChevronDown size={14} className="text-white/20" />
                </div>
                {showUserDropdown && (
                  <div className="absolute z-20 top-full mt-1.5 w-full rounded-xl border border-white/[0.06] bg-[#111A2E] shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/[0.04]">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          placeholder="Поиск..."
                          className="w-full rounded-lg bg-white/[0.03] pl-8 pr-3 py-1.5 text-[13px] text-white/70 placeholder:text-white/15 outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setSelectedUserId(u.id); setSelectedTeamId(u.teamId ?? ''); setShowUserDropdown(false); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="h-6 w-6 rounded-full bg-[#4C7DFF]/15 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-[#4C7DFF]">
                              {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-[13px] text-white/80 truncate">{u.fullName}</p>
                            <p className="text-[11px] text-white/25">{u.position ?? ''}</p>
                          </div>
                          {u.id === selectedUserId && <Check size={14} className="text-[#4C7DFF] ml-auto shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team selector */}
          <div className="field-shell">
            <span className="field-label">Команда</span>
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              className="field-input"
            >
              <option value="">Без команды</option>
              {teams?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Type selector */}
          <div className="field-shell">
            <span className="field-label">Тип заявки</span>
            {fieldError('type') && <span className="text-[12px] text-rose-400 ml-2">{fieldError('type')}</span>}
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {REQUEST_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={[
                    'rounded-xl border px-3.5 py-3 text-left transition-all',
                    type === t.value
                      ? 'border-[#4C7DFF]/40 bg-[#4C7DFF]/10'
                      : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10]',
                  ].join(' ')}
                >
                  <p className={type === t.value ? 'text-[14px] font-bold text-[#4C7DFF]' : 'text-[14px] font-semibold text-white/60'}>{t.label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="field-shell">
              <span className="field-label">Дата начала *</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setErrors([]); }}
                className={`field-input ${fieldError('dateFrom') ? 'border-rose-500/40' : ''}`}
              />
              {fieldError('dateFrom') && <span className="text-[11px] text-rose-400 mt-0.5">{fieldError('dateFrom')}</span>}
            </div>
            <div className="field-shell">
              <span className="field-label">Дата окончания</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setErrors([]); }}
                className={`field-input ${fieldError('dateTo') ? 'border-rose-500/40' : ''}`}
              />
              {fieldError('dateTo') && <span className="text-[11px] text-rose-400 mt-0.5">{fieldError('dateTo')}</span>}
            </div>
          </div>

          {/* Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div className="field-shell">
              <span className="field-label">Часы *</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="240"
                value={hours}
                onChange={e => { setHours(e.target.value); setErrors([]); }}
                className={`field-input ${fieldError('hours') ? 'border-rose-500/40' : ''}`}
              />
              {fieldError('hours') && <span className="text-[11px] text-rose-400 mt-0.5">{fieldError('hours')}</span>}
            </div>
            <div className="field-shell">
              <span className="field-label">Статус</span>
              <div className="flex items-center gap-2 h-[42px] px-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06]">
                <Clock size={14} className="text-amber-400" />
                <span className="text-[13px] text-amber-400 font-semibold">
                  {isReprocess ? 'На согласовании' : 'На согласовании'}
                </span>
              </div>
            </div>
          </div>

          {/* Approvers preview */}
          {approvers.length > 0 && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-white/30" />
                <span className="text-[12px] font-semibold text-white/35 uppercase tracking-wider">Согласующие</span>
                <span className="rounded-full bg-[#4C7DFF]/15 px-2 py-0.5 text-[10px] font-bold text-[#4C7DFF]">{approvers.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {approvers.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5" title={a.fullName}>
                    <div className="h-5 w-5 rounded-full bg-[#4C7DFF]/20 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-[#4C7DFF]">{a.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-[11px] text-white/50">{a.fullName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="field-shell">
            <span className="field-label">Причина *</span>
            <input
              value={reason}
              onChange={e => { setReason(e.target.value); setErrors([]); }}
              placeholder="Укажите причину заявки"
              className={`field-input ${fieldError('reason') ? 'border-rose-500/40' : ''}`}
            />
            {fieldError('reason') && <span className="text-[11px] text-rose-400 mt-0.5">{fieldError('reason')}</span>}
          </div>

          {/* Comment */}
          <div className="field-shell">
            <span className="field-label">Комментарий / Примечание</span>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Дополнительная информация, заметки..."
              className="field-input resize-none"
            />
          </div>

          {/* File upload placeholder */}
          <div className="field-shell">
            <span className="field-label">Вложения (опционально)</span>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-5 transition-colors hover:border-white/[0.15] cursor-pointer">
              <div className="flex flex-col items-center gap-1.5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.04]">
                  <Upload size={15} className="text-white/25" />
                </div>
                <p className="text-[12px] text-white/25">Перетащите файлы или нажмите для загрузки</p>
                <p className="text-[10px] text-white/15">PDF, DOCX, изображения до 10 МБ</p>
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="rounded-xl bg-[#111A2E] border border-white/[0.05] p-4 space-y-2">
            <p className="text-[11px] font-bold text-white/25 uppercase tracking-wider">Сводка заявки</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <span className="text-[12px] text-white/35">Тип</span>
              <span className="text-[12px] font-medium text-white/70 text-right">{selectedTypeMeta?.label ?? '—'}</span>
              <span className="text-[12px] text-white/35">Сотрудник</span>
              <span className="text-[12px] font-medium text-white/70 text-right truncate">{selectedUser?.fullName ?? currentUser.fullName}</span>
              <span className="text-[12px] text-white/35">Период</span>
              <span className="text-[12px] font-medium text-white/70 text-right">
                {dateFrom ? new Date(dateFrom).toLocaleDateString('ru-RU') : '—'}
                {dateTo ? ` — ${new Date(dateTo).toLocaleDateString('ru-RU')}` : ''}
              </span>
              <span className="text-[12px] text-white/35">Часы</span>
              <span className="text-[12px] font-medium text-white/70 text-right">{hours}ч</span>
              <span className="text-[12px] text-white/35">Статус</span>
              <span className="text-[12px] font-medium text-amber-400 text-right">На согласовании</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-[#0F1829] px-6 py-4 border-t border-white/[0.05] rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <div className="flex items-center gap-2.5">
            {errors.length > 0 && (
              <span className="text-[12px] text-rose-400 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.length} ошиб.
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Создаём...' : 'Отправить на согласование'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
