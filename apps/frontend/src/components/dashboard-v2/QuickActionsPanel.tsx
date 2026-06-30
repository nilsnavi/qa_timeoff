import { Plus, CalendarDays, FileText, WalletCards, CheckCircle2, Users, BarChart3, Upload, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { QuickAction } from '../../shared/types';

const iconMap: Record<string, React.ElementType> = {
  plus: Plus,
  calendar: CalendarDays,
  'file-text': FileText,
  wallet: WalletCards,
  'check-circle': CheckCircle2,
  users: Users,
  'bar-chart': BarChart3,
  upload: Upload,
  settings: Settings,
};

export function QuickActionsPanel({ actions }: { actions: QuickAction[] }) {
  const navigate = useNavigate();

  if (!actions.length) {
    return (
      <div className="enterprise-card p-4">
        <h3 className="text-[14px] font-bold text-white mb-3">Быстрые действия</h3>
        <div className="rounded-lg bg-white/[0.02] p-4 text-center">
          <p className="text-[13px] text-white/40">Нет доступных действий</p>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-card p-4">
      <h3 className="text-[14px] font-bold text-white mb-3">Быстрые действия</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, i) => {
          const Icon = iconMap[action.icon] ?? Plus;
          return (
            <button
              key={i}
              type="button"
              onClick={() => navigate(action.url)}
              className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3.5 text-[14px] font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white hover:border-white/[0.1] transition-all"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#4C7DFF]/15">
                <Icon size={16} className="text-[#6B96FF]" />
              </span>
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
