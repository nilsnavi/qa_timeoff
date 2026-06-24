import { Check, X } from 'lucide-react';
import { Button, Card, StatusBadge } from '../ui';
import type { TimeOffRequest } from '../../shared/types';

export function RequestList({
  requests,
  onApprove,
  onReject,
}: {
  requests: TimeOffRequest[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {requests.map((request) => (
        <Card key={request.id}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#7A8599]">{request.user.fullName}</p>
              <h2 className="text-lg font-black text-white">Отгул</h2>
            </div>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-sm font-semibold text-[#7A8599]">
            {request.date} · {request.hours} ч
          </p>
          <p className="mt-2 text-sm text-[#7A8599]">{request.reason}</p>
          {request.status === 'PENDING' && onApprove && onReject && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onReject(request.id)}>
                <X size={18} /> Отклонить
              </Button>
              <Button onClick={() => onApprove(request.id)}>
                <Check size={18} /> Одобрить
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
