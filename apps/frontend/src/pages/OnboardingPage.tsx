import { useMutation } from '@tanstack/react-query';
import { Building2, Check, ChevronRight, Sparkles, Upload, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field } from '../components/ui';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { showAppToast } from '../shared/utils';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Компания', 'Администратор', 'Сотрудники', 'Готово'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { setAuthFromResponse } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [skipImport, setSkipImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: () => api.registerOrganization({ companyName, adminFullName, adminEmail, adminPassword }),
    onSuccess: (data) => { setAuthFromResponse(data); setStep(3); },
    onError: (err: any) => { setError(err?.message ?? 'Не удалось создать организацию'); },
  });

  const importMutation = useMutation({
    mutationFn: () => api.validateImport('USERS', importFile!).then(p => api.runImport(p.importJobId, true)),
    onSuccess: () => { showAppToast('Сотрудники импортированы'); setStep(4); },
    onError: () => { showAppToast('Не удалось импортировать — можно сделать это позже', undefined, 'error'); setStep(4); },
  });

  function handleStep1Next() {
    setError(null);
    if (companyName.trim().length < 2) { setError('Введите название компании'); return; }
    setStep(2);
  }

  function handleStep2Submit() {
    setError(null);
    if (adminFullName.trim().length < 2) { setError('Введите ваше имя'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) { setError('Некорректный email'); return; }
    if (adminPassword.length < 8) { setError('Пароль должен быть не короче 8 символов'); return; }
    if (adminPassword !== adminPasswordConfirm) { setError('Пароли не совпадают'); return; }
    registerMutation.mutate();
  }

  function handleStep3Next() {
    if (skipImport || !importFile) { setStep(4); }
    else { importMutation.mutate(); }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="mb-8 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const num = (i + 1) as Step;
          const isActive = step === num;
          const isDone = step > num;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'app-gradient text-white' : 'bg-white/[0.06] text-white/30'}`}>
                {isDone ? <Check size={14} /> : num}
              </div>
              {i < STEP_LABELS.length - 1 && <div className={`h-0.5 flex-1 rounded ${isDone ? 'bg-emerald-500' : 'bg-white/[0.06]'}`} />}
            </div>
          );
        })}
      </div>
      <p className="mb-6 text-center text-[13px] font-semibold text-white/40">Шаг {step} из 4 — {STEP_LABELS[step - 1]}</p>

      {step === 1 && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#4C7DFF]/15"><Building2 size={26} className="text-[#4C7DFF]" /></div>
            <h1 className="text-[22px] font-bold text-white">Добро пожаловать в QA TimeOff</h1>
            <p className="mt-1.5 text-[14px] text-white/40">Как называется ваша компания?</p>
          </div>
          <Field label="Название компании" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="ООО «Рога и Копыта»" autoFocus />
          {error && <p className="text-[14px] font-medium text-rose-400">{error}</p>}
          <Button onClick={handleStep1Next} className="w-full">Продолжить <ChevronRight size={16} className="ml-1" /></Button>
          <p className="text-center text-[13px] text-white/30">Уже есть аккаунт? <button onClick={() => navigate('/login')} className="text-[#4C7DFF] hover:text-[#6B96FF]">Войти</button></p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center mb-2">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15"><UserPlus size={26} className="text-violet-400" /></div>
            <h1 className="text-[22px] font-bold text-white">Создайте аккаунт администратора</h1>
            <p className="mt-1.5 text-[14px] text-white/40">{companyName}</p>
          </div>
          <Field label="Ваше имя" value={adminFullName} onChange={e => setAdminFullName(e.target.value)} placeholder="Иванов Иван" autoFocus />
          <Field label="Email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="ivanov@company.ru" />
          <Field label="Пароль" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Минимум 8 символов" />
          <Field label="Повторите пароль" type="password" value={adminPasswordConfirm} onChange={e => setAdminPasswordConfirm(e.target.value)} />
          {error && <p className="text-[14px] font-medium text-rose-400">{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Назад</Button>
            <Button onClick={handleStep2Submit} disabled={registerMutation.isPending} className="flex-1">{registerMutation.isPending ? 'Создаём...' : 'Создать аккаунт'}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15"><Upload size={26} className="text-emerald-400" /></div>
            <h1 className="text-[22px] font-bold text-white">Добавьте сотрудников</h1>
            <p className="mt-1.5 text-[14px] text-white/40">Загрузите CSV со списком сотрудников — этот шаг можно пропустить</p>
          </div>
          <div className="rounded-xl border border-dashed border-white/20 p-6 text-center">
            <input type="file" accept=".csv" id="onboarding-csv" className="hidden" onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
            <label htmlFor="onboarding-csv" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4C7DFF]/15 border border-[#4C7DFF]/25 px-4 py-2.5 text-[14px] font-semibold text-[#6B96FF] hover:bg-[#4C7DFF]/25"><Upload size={15} />{importFile ? importFile.name : 'Выбрать CSV-файл'}</label>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setSkipImport(true); setStep(4); }} className="flex-1">Пропустить</Button>
            <Button onClick={handleStep3Next} disabled={importMutation.isPending} className="flex-1">{importMutation.isPending ? 'Импортируем...' : 'Импортировать'}</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15"><Sparkles size={28} className="text-emerald-400" /></div>
          <div>
            <h1 className="text-[22px] font-bold text-white">Всё готово!</h1>
            <p className="mt-2 text-[14px] text-white/40">Организация «{companyName}» создана. У вас есть 14 дней бесплатного триала.</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-4 text-left space-y-1.5">
            <p className="text-[13px] font-semibold text-white/50">Что дальше:</p>
            <ul className="text-[13px] text-white/40 space-y-1 list-disc list-inside">
              <li>Настройте параметры баланса в разделе «Настройки»</li>
              <li>Пригласите остальных сотрудников или довершите импорт</li>
              <li>Настройте роли и права доступа</li>
            </ul>
          </div>
          <Button onClick={() => navigate('/')} className="w-full">Перейти в приложение</Button>
        </div>
      )}
    </main>
  );
}
