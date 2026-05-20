import { Card } from '../components/ui';
import { useDashboard } from '../shared/hooks/useDashboard';

export function ProfilePage() {
  const { dashboard } = useDashboard();
  const user = dashboard.user;

  return (
    <Card>
      <h2 className="mb-3 text-lg font-black text-slate-950">Profile</h2>
      <div className="grid gap-2 text-sm">
        <InfoRow label="Name" value={user.fullName} />
        <InfoRow label="Role" value={user.role} />
        <InfoRow label="Team" value={user.team?.name ?? user.teamId ?? '-'} />
        <InfoRow label="Position" value={user.position ?? '-'} />
        <InfoRow label="Telegram" value={`@${user.username ?? user.telegramId}`} />
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/55 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}
