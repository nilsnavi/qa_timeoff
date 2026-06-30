import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, Modal } from '../../components/ui';
import { CustomSelect } from '../../components/ui/CustomSelect';
import type { SelectOption } from '../../components/ui/CustomSelect';
import { api } from '../../shared/api';
import type { PermissionDto } from '../../shared/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const GROUP_NAMES: Record<string, string> = {
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

export function CreateRoleModal({ open, onClose, onCreated }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRoleCode, setBaseRoleCode] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => api.roles(), enabled: open });
  const permsQuery = useQuery({ queryKey: ['permissions'], queryFn: api.permissions, enabled: open });

  const baseOptions: SelectOption[] = [
    { value: '', label: 'Пустая роль' },
    ...(rolesQuery.data ?? []).map(r => ({ value: r.code, label: `${r.name} (${r.permissions?.length ?? 0} прав)` })),
  ];

  const permissions = permsQuery.data ?? [];
  const grouped = new Map<string, PermissionDto[]>();
  for (const p of permissions) {
    const group = p.groupName || 'Прочее';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(p);
  }

  const togglePerm = (code: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) {
      setError('Название и код обязательны');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createRole({
        code: code.trim(),
        name: name.trim(),
        description,
        basedOnRoleCode: baseRoleCode || undefined,
        permissionCodes: selectedPerms.size > 0 ? Array.from(selectedPerms) : undefined,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Ошибка создания роли');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setName('');
    setDescription('');
    setBaseRoleCode('');
    setSelectedPerms(new Set());
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Создать роль"
      onClose={handleClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleClose}>Отмена</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Создание...' : 'Создать'}</Button>
        </div>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Field label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Координатор QA" />
        <Field label="Код роли" value={code} onChange={e => setCode(e.target.value)} placeholder="КООРДИНАТОР_QA" />
        <Field label="Описание" value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание роли" />
        <div className="field-shell">
          <span className="field-label">Основана на роли</span>
          <CustomSelect value={baseRoleCode} onChange={setBaseRoleCode} options={baseOptions} placeholder="Пустая роль" />
        </div>
        <p className="text-[12px] text-white/30">При выборе базовой роли права будут скопированы, после чего можно выбрать дополнительные.</p>

        {permissions.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <span className="text-[13px] font-bold text-white/40 uppercase">Права доступа ({selectedPerms.size} выбрано)</span>
            {Array.from(grouped.entries()).map(([group, perms]) => (
              <div key={group} className="enterprise-card p-3 space-y-1.5">
                <h3 className="text-[13px] font-bold text-white/70">{GROUP_NAMES[group] || group}</h3>
                {perms.map(p => (
                  <label key={p.code} className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedPerms.has(p.code)}
                      onChange={() => togglePerm(p.code)}
                      className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-[#4C7DFF]"
                    />
                    <span className="text-[13px] text-white/80">{p.name}</span>
                    <span className="text-[11px] text-white/30 ml-auto font-mono">{p.code}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-[13px] text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}
