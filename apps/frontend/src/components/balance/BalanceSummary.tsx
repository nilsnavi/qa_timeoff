import { ShieldCheck } from 'lucide-react';
import type { TimeBalance } from '../../shared/types';

export function BalanceSummary({ balance }: { balance: TimeBalance }) {
  return (
    <section
      className="overflow-hidden rounded-[24px] p-5 text-white shadow-2xl shadow-blue-500/25 ring-1 ring-white/25 md:p-6"
      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 58%, #0ea5e9 100%)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-white/80">Доступно</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-5xl font-black leading-none text-white drop-shadow-sm">{balance.balanceHours}</span>
            <span className="pb-1 text-base font-black text-white/90">ч</span>
          </div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-[18px] bg-white/18 ring-1 ring-white/25">
          <ShieldCheck size={25} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-center">
        <Metric label="Начислено" value={balance.totalAddedHours} />
        <Metric label="Использовано" value={balance.totalUsedHours} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/18 p-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[11px] font-bold text-white/80">{label}</p>
    </div>
  );
}
