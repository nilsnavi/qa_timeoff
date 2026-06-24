import { Loader2, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';

export function LoginPage() {
  const { login, isAuthLoading, authError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch {
      setError(authError ?? 'Неверный email или пароль');
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-6 py-8 safe-area">
      <div className="w-full max-w-sm space-y-8 animate-fadeIn">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl app-gradient shadow-lg shadow-blue-500/30">
            <LogIn size={24} className="text-white" />
          </div>
          <h1 className="text-[22px] font-bold text-white">QA TimeOff</h1>
          <p className="mt-1.5 text-[14px] font-medium text-[#B8C0D0]">Войдите в систему</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field-shell">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoComplete="email"
              autoFocus
              className="field-input"
            />
          </div>

          <div className="field-shell">
            <span className="field-label">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="············"
              autoComplete="current-password"
              className="field-input"
            />
          </div>

          {error && (
            <p className="text-[13px] font-medium text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isAuthLoading}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] app-gradient px-4 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-blue-500/20 transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Вход...
              </>
            ) : (
              'Войти'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
