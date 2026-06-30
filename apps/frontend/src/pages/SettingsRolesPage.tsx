import { Shield } from 'lucide-react';

export function SettingsRolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-white">Управление ролями</h1>
        <p className="text-[15px] text-white/40 mt-1">Настройка прав доступа для пользователей</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { role: 'ADMIN', color: 'text-rose-400', desc: 'Полный доступ ко всем разделам' },
          { role: 'MANAGER', color: 'text-amber-400', desc: 'Управление командами и аналитика' },
          { role: 'LEAD', color: 'text-blue-400', desc: 'Своя команда и согласование' },
          { role: 'EMPLOYEE', color: 'text-emerald-400', desc: 'Только свои заявки и баланс' },
        ].map((r) => (
          <div key={r.role} className="enterprise-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield size={16} className={r.color} />
              <span className="text-[15px] font-bold text-white">{r.role}</span>
            </div>
            <p className="text-[13px] text-white/40">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
