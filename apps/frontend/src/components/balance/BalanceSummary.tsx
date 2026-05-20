import { ShieldCheck } from 'lucide-react';
import { Card } from '../ui';
import type { TimeBalance } from '../../shared/types';

export function BalanceSummary({ balance }: { balance: TimeBalance }) {
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-sky-500/90 to-emerald-400/80 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold opacity-85">Available</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-5xl font-black leading-none">{balance.balanceHours}</span>
            <span className="pb-1 text-base font-bold opacity-90">hours</span>
          </div>
        </div>
        <ShieldCheck size={34} />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 text-center">
        <Metric label="Added" value={balance.totalAddedHours} />
        <Metric label="Used" value={balance.totalUsedHours} />
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/20 p-3">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[11px] font-bold opacity-80">{label}</p>
    </div>
  );
}
