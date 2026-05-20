import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Field } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';

export function AdminPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState('Manual correction');
  const userId = dashboard.user.id;
  const add = useMutation({
    mutationFn: api.addBalance,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const writeOff = useMutation({
    mutationFn: api.writeOffBalance,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  return (
    <Card>
      <h2 className="mb-3 text-lg font-black text-slate-950">Admin</h2>
      <div className="grid gap-3">
        <Field label="Hours" type="number" min={1} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
        <Field label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => writeOff.mutate({ userId, hours, reason })}>
            Write off
          </Button>
          <Button onClick={() => add.mutate({ userId, hours, reason })}>Add</Button>
        </div>
      </div>
    </Card>
  );
}
