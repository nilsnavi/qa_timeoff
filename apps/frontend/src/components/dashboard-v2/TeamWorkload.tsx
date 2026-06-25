import { AlertCircle, Users } from 'lucide-react';
import type { Dashboard } from '../../shared/types';

export function TeamWorkload({ dashboard }: { dashboard: Dashboard }) {
  const userNames = new Map<string, { name: string; pending: number; approved: number }>();
  for (const r of dashboard.requests) {
    const userName = ('user' in r ? (r as any).user?.fullName : (r as any).employeeName) || 'Неизвестно';
    const entry = userNames.get(userName) || { name: userName, pending: 0, approved: 0 };
    if (r.status === 'PENDING') entry.pending++;
    if (r.status === 'APPROVED') entry.approved++;
    userNames.set(userName, entry);
  }
  for (const v of dashboard.vacations ?? []) {
    const userName = ('user' in v ? (v as any).user?.fullName : (v as any).employeeName) || 'Неизвестно';
    const entry = userNames.get(userName) || { name: userName, pending: 0, approved: 0 };
    if (v.status === 'PENDING') entry.pending++;
    if (v.status === 'APPROVED') entry.approved++;
    userNames.set(userName, entry);
  }

  const members = Array.from(userNames.values()).sort((a, b) => b.pending - a.pending);
  const maxLoad = Math.max(...members.map(m => m.pending + m.approved), 1);

  return (
    <div className="enterprise-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-white/40" />
        <p className="text-[13px] font-semibold text-white/50">Нагрузка команды</p>
      </div>

      {members.length === 0 ? (
        <p className="text-[14px] text-white/40 py-4 text-center">Нет данных о команде</p>
      ) : (
        <div className="space-y-2">
          {members.slice(0, 8).map((member) => {
            const total = member.pending + member.approved;
            const ratio = total / maxLoad;
            return (
              <div key={member.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[14px] font-medium text-white/70 truncate">{member.name}</span>
                <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden flex">
                  {member.approved > 0 && (
                    <div className="h-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold transition-all"
                      style={{ width: `${(member.approved / total) * ratio * 100}%`, minWidth: member.approved > 0 ? '28px' : '0' }}>
                      {member.approved > 1 ? member.approved : ''}
                    </div>
                  )}
                  {member.pending > 0 && (
                    <div className="h-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-bold transition-all"
                      style={{ width: `${(member.pending / total) * ratio * 100}%`, minWidth: member.pending > 0 ? '28px' : '0' }}>
                      {member.pending > 1 ? member.pending : ''}
                    </div>
                  )}
                </div>
                {member.pending > 3 && <AlertCircle size={14} className="text-rose-400 shrink-0" />}
                <span className="w-8 text-right text-[14px] font-bold text-white/50">{total}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/40" />
          <span className="text-[12px] text-white/40">Одобрено</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-amber-500/40" />
          <span className="text-[12px] text-white/40">Ожидает</span>
        </div>
      </div>
    </div>
  );
}
