import { CalendarDays, ChevronRight, Clock3, MousePointer2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { hapticSelection } from '../shared/utils';

const onboardingStorageKey = 'qa-timeoff-onboarding-complete';

const slides = [
  {
    title: 'Ваше время под контролем',
    description: 'Баланс отгулов, история операций и статусы заявок всегда рядом.',
    icon: Clock3,
    accent: 'from-violet-500 via-blue-600 to-sky-500',
  },
  {
    title: 'Отгулы и отпуска в 2 клика',
    description: 'Создавайте заявки быстро, а руководитель увидит их сразу.',
    icon: MousePointer2,
    accent: 'from-blue-500 via-cyan-500 to-emerald-400',
  },
  {
    title: 'Календарь команды всегда под рукой',
    description: 'Смотрите отпуска, отгулы и ближайшие события без лишнего шума.',
    icon: CalendarDays,
    accent: 'from-emerald-500 via-blue-500 to-violet-500',
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const Icon = slide.icon;
  const progress = useMemo(() => ((index + 1) / slides.length) * 100, [index]);

  const finish = () => {
    localStorage.setItem(onboardingStorageKey, 'true');
    hapticSelection();
    navigate('/', { replace: true });
  };

  const next = () => {
    hapticSelection();
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => current + 1);
  };

  return (
    <main className="mx-auto flex min-h-[var(--tg-viewport-height)] w-full max-w-xl flex-col px-5 py-5 safe-area">
      <div className="flex items-center justify-between">
        <div className="h-2 w-28 overflow-hidden rounded-full bg-[#111A2E]/70 shadow-sm dark:bg-slate-800">
          <div className="h-full rounded-full app-gradient transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button type="button" className="min-h-10 px-3 text-sm font-black text-[#B8C0D0]" onClick={finish}>
          Пропустить
        </button>
      </div>

      <section className="grid flex-1 place-items-center py-8">
        <div className="w-full text-center">
          <div className={`mx-auto grid h-72 w-full max-w-sm place-items-center rounded-[36px] bg-gradient-to-br ${slide.accent} p-8 text-white shadow-2xl shadow-blue-500/20`}>
            <div className="grid h-40 w-40 place-items-center rounded-[48px] bg-white/20 ring-1 ring-white/25 backdrop-blur">
              <Icon size={82} strokeWidth={1.7} />
            </div>
          </div>

          <div className="mt-8 min-h-36">
            <h1 className="text-3xl font-black leading-tight text-white">{slide.title}</h1>
            <p className="mx-auto mt-4 max-w-xs text-base font-semibold leading-relaxed text-[#B8C0D0]">{slide.description}</p>
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {slides.map((item) => (
              <span
                key={item.title}
                className={`h-2 rounded-full transition-all ${item.title === slide.title ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300 dark:bg-slate-700'}`}
              />
            ))}
          </div>
        </div>
      </section>

      <Button size="lg" onClick={next}>
        {isLast ? 'Начать' : 'Далее'}
        <ChevronRight size={19} />
      </Button>
    </main>
  );
}

export function isOnboardingComplete() {
  return localStorage.getItem(onboardingStorageKey) === 'true';
}
