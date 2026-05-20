import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RequestList } from '../components/requests/RequestList';
import { Card, StatusBadge } from '../components/ui';
import { api } from '../shared/api';
import { useDashboard } from '../shared/hooks/useDashboard';

export function RequestsPage() {
  const { dashboard } = useDashboard();
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: api.approveTimeOff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectTimeOff(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  return (
    <>
      <RequestList requests={dashboard.requests} onApprove={(id) => approve.mutate(id)} onReject={(id) => reject.mutate(id)} />
      <Card>
        <h2 className="mb-3 text-lg font-black text-slate-950">Vacations</h2>
        <div className="grid gap-2">
          {(dashboard.vacations ?? []).map((request) => (
            <div key={request.id} className="flex items-center justify-between rounded-2xl bg-white/65 p-3">
              <div>
                <p className="font-bold text-slate-800">{request.user.fullName}</p>
                <p className="text-sm text-slate-500">
                  {request.startDate} - {request.endDate}
                </p>
              </div>
              <StatusBadge status={request.status} />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
