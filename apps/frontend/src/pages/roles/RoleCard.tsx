import { Shield } from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import type { RoleDetail } from '../../shared/types';

export function RoleCard({ role, onOpen }: { role: RoleDetail; onOpen: (role: RoleDetail) => void }) {
  const permCount = role.permissions?.length ?? 0;
  const userCount = role._count?.users ?? 0;

  return (
    <div className="enterprise-card p-4 space-y-3 hover-lift">
      <div className="flex items-center gap-2">
        <Shield size={16} className={role.isSystem ? 'text-amber-400' : 'text-[#4C7DFF]'} />
        <span className="text-[15px] font-bold text-white">{role.name}</span>
      </div>
      <p className="text-[13px] text-white/40 line-clamp-2 min-h-[2.5em]">{role.description || 'Нет описания'}</p>
      <div className="flex items-center gap-2">
        <Badge tone={role.isSystem ? 'warning' : 'info'}>{role.isSystem ? 'Системная' : 'Пользовательская'}</Badge>
        {!role.isActive && <Badge tone="neutral">Отключена</Badge>}
      </div>
      <div className="flex items-center justify-between text-[12px] text-white/30">
        <span>Пользователей: <span className="font-semibold text-white/60">{userCount}</span></span>
        <span>Прав: <span className="font-semibold text-white/60">{permCount}</span></span>
      </div>
      <Button variant="secondary" size="sm" className="w-full" onClick={() => onOpen(role)}>
        {role.isSystem ? 'Просмотр' : 'Настроить'}
      </Button>
    </div>
  );
}
