import { Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { PendingApprovalItem } from '../../shared/types';
import { api } from '../../shared/api';
import { useQueryClient } from '@tanstack/react-query';
import { showAppToast } from '../../shared/utils';

const typeColors: Record<string, string> = {
  TIME_OFF: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VACATION: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const typeIcons: Record<string, string> = {
  TIME_OFF: 'ОТ',
  VACATION: 'ОП',
};

export function PendingApprovalsWidget({ approvals }: { approvals: PendingApprovalItem[] }) {
  const queryClient = useQueryClient();
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const setLoading = (id: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleApprove = async (id: string) => {
    setLoading(id, true);
    try {
      await api.approveLeaveRequest(id);
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      showAppToast('Заявка согласована', undefined, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось согласовать заявку';
      showAppToast('Ошибка', msg, 'error');
    } finally {
      setLoading(id, false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(id, true);
    try {
      await api.rejectLeaveRequest(id);
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      showAppToast('Заявка отклонена', undefined, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось отклонить заявку';
      showAppToast('Ошибка', msg, 'error');
    } finally {
      setLoading(id, false);
    }
  };

  return (
    <div className="enterprise-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-white">Заявки на согласование</h3>
        {approvals.length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[12px] font-bold text-amber-400">
            {approvals.length}
          </span>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-lg bg-white/[0.02] p-4 text-center">
          <p className="text-[13px] text-white/40">Нет заявок на согласование</p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.slice(0, 5).map((item) => {
            const isLoading = loadingIds.has(item.id);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/[0.04] p-3"
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${typeColors[item.type] ?? 'bg-white/[0.05] text-white/50 border-white/[0.08]'}`}>
                  <span className="text-[12px] font-bold">{typeIcons[item.type] ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white/80 truncate">{item.employeeName}</p>
                  <p className="text-[12px] text-white/40">
                    {item.typeLabel}, {item.hours} ч — {item.dateFrom}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApprove(item.id)}
                    disabled={isLoading}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                    title="Согласовать"
                  >
                    {isLoading ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : <Check size={14} className="text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(item.id)}
                    disabled={isLoading}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 transition-colors"
                    title="Отклонить"
                  >
                    {isLoading ? <Loader2 size={12} className="animate-spin text-rose-400" /> : <X size={14} className="text-rose-400" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
