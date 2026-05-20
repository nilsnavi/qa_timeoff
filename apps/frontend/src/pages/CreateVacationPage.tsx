import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, Select } from '../components/ui';
import { api } from '../shared/api';
import type { VacationType } from '../shared/types';
import { toDateInputValue } from '../shared/utils/date';

export function CreateVacationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(toDateInputValue());
  const [endDate, setEndDate] = useState(toDateInputValue());
  const [vacationType, setVacationType] = useState<VacationType>('ANNUAL');
  const [comment, setComment] = useState('');
  const mutation = useMutation({
    mutationFn: api.createVacation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/requests');
    },
  });

  return (
    <Card>
      <h2 className="mb-3 text-lg font-black text-slate-950">Create vacation</h2>
      <div className="grid gap-3">
        <Field label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Field label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <Select label="Type" value={vacationType} onChange={(event) => setVacationType(event.target.value as VacationType)}>
          <option value="ANNUAL">Annual</option>
          <option value="UNPAID">Unpaid</option>
          <option value="SICK_LEAVE">Sick leave</option>
          <option value="OTHER">Other</option>
        </Select>
        <Field label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} />
        <Button onClick={() => mutation.mutate({ startDate, endDate, vacationType, comment })} disabled={mutation.isPending}>
          Create
        </Button>
      </div>
    </Card>
  );
}
