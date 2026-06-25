import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth/AuthContext';
import { showAppToast } from '../shared/utils';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { setMustChangePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setMustChangePassword(false);
      showAppToast('Пароль изменён', 'Добро пожаловать в систему');
      navigate('/', { replace: true });
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Не удалось изменить пароль');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('Новый пароль должен содержать минимум 8 символов');
      return;
    }
    if (next !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (next === current) {
      setError('Новый пароль должен отличаться от временного');
      return;
    }
    mutation.mutate();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/15 border border-amber-500/20">
            <ShieldCheck size={28} className="text-amber-400" />
          </div>
          <h1 className="text-[22px] font-bold text-white">Смените пароль</h1>
          <p className="mt-1.5 text-[14px] text-white/40">
            Вы вошли с временным паролем.<br />Установите постоянный пароль для продолжения.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field-shell">
            <span className="field-label">Временный пароль</span>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="············"
                className="field-input pr-10"
                autoFocus
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="field-shell">
            <span className="field-label">Новый пароль</span>
            <div className="relative">
              <input
                type={showNext ? 'text' : 'password'}
                value={next}
                onChange={e => setNext(e.target.value)}
                placeholder="Минимум 8 символов"
                className="field-input pr-10"
              />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {next.length > 0 && (
              <div className="mt-1.5 flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    i < Math.min(Math.floor(next.length / 3), 4)
                      ? next.length >= 12 ? 'bg-emerald-500'
                      : next.length >= 8 ? 'bg-amber-500'
                      : 'bg-rose-500'
                      : 'bg-white/10'
                  }`} />
                ))}
              </div>
            )}
          </div>

          <div className="field-shell">
            <span className="field-label">Повторите новый пароль</span>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="············" className="field-input" />
          </div>

          {error && <p className="text-[14px] font-medium text-rose-400">{error}</p>}

          <button type="submit" disabled={mutation.isPending || !current || !next || !confirm} className="flex w-full items-center justify-center gap-2 rounded-[10px] app-gradient px-4 py-3.5 text-[16px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
            {mutation.isPending ? 'Сохраняем...' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </main>
  );
}
