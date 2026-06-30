import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, Modal } from '../../components/ui';
import { CustomSelect } from '../../components/ui/CustomSelect';
import type { SelectOption } from '../../components/ui/CustomSelect';
import { api } from '../../shared/api';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateRoleModal({ open, onClose, onCreated }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRoleCode, setBaseRoleCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => api.roles(), enabled: open });

  const baseOptions: SelectOption[] = [
    { value: '', label: 'Пустая роль' },
    ...(rolesQuery.data ?? []).map(r => ({ value: r.code, label: `${r.name} (${r.permissions?.length ?? 0} прав)` })),
  ];

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) {
      setError('Название и код обязательны');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createRole({ code: code.trim(), name: name.trim(), description, basedOnRoleCode: baseRoleCode || undefined });
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
      <div className="space-y-4">
        <Field label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Координатор QA" />
        <Field label="Код роли" value={code} onChange={e => setCode(e.target.value)} placeholder="КООРДИНАТОР_QA" />
        <Field label="Описание" value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание роли" />
        <div className="field-shell">
          <span className="field-label">Основана на роли</span>
          <CustomSelect value={baseRoleCode} onChange={setBaseRoleCode} options={baseOptions} placeholder="Пустая роль" />
        </div>
        <p className="text-[12px] text-white/30">При выборе базовой роли права будут скопированы, после чего их можно изменить.</p>
        {error && <p className="text-[13px] text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}
