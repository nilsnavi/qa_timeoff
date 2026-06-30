import { Users, UsersRound, Settings, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardOnboarding, DashboardProfile } from '../../shared/types';

const stepIcons: Record<string, React.ElementType> = {
  team: Users,
  balance: Settings,
  'timeoff/new': FileText,
  create: UsersRound,
};

export function OnboardingWidget({ onboarding, profile }: { onboarding: DashboardOnboarding; profile: DashboardProfile }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg text-center space-y-6">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#4C7DFF]/15">
          <span className="text-[28px]">👋</span>
        </div>
        <div>
          <h1 className="text-[24px] font-bold text-white">
            Добро пожаловать в QA TimeOff
          </h1>
          <p className="text-[15px] text-white/40 mt-2">
            {profile.fullName}, начните настройку системы для вашей команды
          </p>
        </div>

        <div className="space-y-3 text-left">
          {onboarding.steps.map((step, i) => {
            const Icon = stepIcons[step.action] ?? FileText;
            return (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#4C7DFF]/15 text-[14px] font-bold text-[#6B96FF]">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-white/80">{step.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/${step.action}`)}
                  className="shrink-0 rounded-lg bg-[#4C7DFF]/15 px-3 py-1.5 text-[13px] font-semibold text-[#6B96FF] hover:bg-[#4C7DFF]/25 transition-colors"
                >
                  <Icon size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => navigate('/team')}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4C7DFF] px-6 py-3 text-[15px] font-bold text-white hover:bg-[#3C6DE0] transition-colors"
        >
          <Users size={18} /> Добавить сотрудников
        </button>
      </div>
    </div>
  );
}
