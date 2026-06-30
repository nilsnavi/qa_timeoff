import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Loader, Skeleton } from '../../components/ui';
import { api } from '../../shared/api';
import type { PermissionDto, RoleDetail } from '../../shared/types';

type Props = {
  role: RoleDetail;
  isSystem: boolean;
};

export function PermissionsTab({ role, isSystem }: Props) {
  const queryClient = useQueryClient();
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const permsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: api.permissions,
  });
  const permissions = permsQuery.data ?? [];

  const rolePermCodes = new Set(role.permissions?.map(rp => rp.permission.code) ?? []);

  const grouped = new Map<string, PermissionDto[]>();
  for (const p of permissions) {
    const group = p.groupName || 'Прочее';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(p);
  }

  const groupNames: Record<string, string> = {
    'Дашборд': 'Дашборд',
    'Заявки': 'Заявки',
    'Согласование': 'Согласование',
    'Баланс': 'Баланс',
    'Календарь': 'Календарь',
    'Аналитика': 'Аналитика',
    'Отчёты': 'Отчёты',
    'Сотрудники': 'Сотрудники',
    'Команды': 'Команды',
    'Настройки': 'Настройки',
    'Пользователи': 'Пользователи',
    'Роли': 'Роли',
    'Журналы': 'Журналы',
    'Уведомления': 'Уведомления',
  };

  const toggle = (code: string) => {
    if (isSystem) return;
    setChanged(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const isChecked = (code: string) => {
    if (changed.has(code)) return !rolePermCodes.has(code);
    return rolePermCodes.has(code);
  };

  const saveMutation = useMutation({
    mutationFn: (codes: string[]) => api.updateRolePermissions(role.id, codes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', role.id] });
      setChanged(new Set());
    },
  });

  const handleSave = async () => {
    const newCodes = [...rolePermCodes];
    for (const c of changed) {
      const idx = newCodes.indexOf(c);
      if (idx >= 0) newCodes.splice(idx, 1);
      else newCodes.push(c);
    }
    setSaving(true);
    saveMutation.mutate(newCodes);
    setSaving(false);
  };

  if (permsQuery.isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-white/40 uppercase">Права доступа ({permissions.length})</span>
        {changed.size > 0 && (
          <Button size="sm" onClick={handleSave} disabled={saving || isSystem}>
            {saving ? 'Сохранение...' : `Сохранить изменения (${changed.size})`}
          </Button>
        )}
      </div>

      {Array.from(grouped.entries()).map(([group, perms]) => (
        <div key={group} className="enterprise-card p-4 space-y-3">
          <h3 className="text-[14px] font-bold text-white/70">{groupNames[group] || group} ({perms.length})</h3>
          <div className="grid gap-1.5">
            {perms.map((p) => (
              <label
                key={p.code}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${isSystem ? 'cursor-default' : 'cursor-pointer hover:bg-white/[0.04]'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked(p.code)}
                  onChange={() => toggle(p.code)}
                  disabled={isSystem}
                  className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-[#4C7DFF]"
                />
                <div className="min-w-0">
                  <span className="text-[14px] text-white/80">{p.name}</span>
                  <span className="text-[12px] text-white/30 ml-2 font-mono">{p.code}</span>
                  {isSystem && <span className="text-[11px] text-amber-400/60 ml-2">(системная)</span>}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
