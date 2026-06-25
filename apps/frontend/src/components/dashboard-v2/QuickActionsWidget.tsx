import { CalendarDays, ClipboardList, Download, FileCheck, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Dashboard } from '../../shared/types';

interface Action {
  icon: React.ElementType;
  label: string;
  path: string;
  color: string;
  bg: string;
}

export function QuickActionsWidget({ dashboard }: { dashboard: Dashboard }) {
  const navigate = useNavigate();
  const isManager = ['LEAD', 'MANAGER', 'ADMIN'].includes(dashboard.user.role);

  const employeeActions: Action[] = [
    { icon: Plus, label: 'Новый отгул', path: '/timeoff/new', color: 'text-[#4C7DFF]', bg: 'bg-[#4C7DFF]/10' },
    { icon: CalendarDays, label: 'Отпуск', path: '/vacation/new', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { icon: ClipboardList, label: 'Мои заявки', path: '/requests/my', color: 'text-white/50', bg: 'bg-white/[0.05]' },
    { icon: FileCheck, label: 'Баланс', path: '/balance', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const managerActions: Action[] = [
    { icon: Plus, label: 'Новый отгул', path: '/timeoff/new', color: 'text-[#4C7DFF]', bg: 'bg-[#4C7DFF]/10' },
    { icon: Users, label: 'Команда', path: '/team', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { icon: FileCheck, label: 'Согласовать', path: '/requests', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: Download, label: 'Аналитика', path: '/analytics', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const actions = isManager ? managerActions : employeeActions;

  return (
    <div className="enterprise-card p-6">
      <p className="text-[13px] font-semibold text-white/50 mb-4">Быстрые действия</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ icon: Icon, label, path, color, bg }) => (
          <button key={path} type="button" onClick={() => navigate(path)}
            className={`flex items-center gap-3 rounded-xl ${bg} border border-white/[0.06] px-4 py-3.5 text-left transition-all hover:border-white/[0.12] hover:brightness-110`}>
            <Icon size={16} className={color} />
            <span className={`text-[14px] font-semibold ${color}`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
