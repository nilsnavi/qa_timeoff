import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '../components/ui';
import { api } from '../shared/api';
import { showAppToast } from '../shared/utils';

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.acceptInvite(token, { fullName, password }),
    onSuccess: () => {
      setSuccess(true);
      showAppToast('Регистрация завершена', 'Теперь вы можете войти', 'success');
    },
    onError: (err: any) => {
      showAppToast('Ошибка', err?.message ?? 'Не удалось принять приглашение', 'error');
    },
  });

  if (success) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center space-y-4 p-8">
          <CheckCircle2 size={48} className="mx-auto text-emerald-400" />
          <h1 className="text-[20px] font-bold text-white">Приглашение принято!</h1>
          <p className="text-[14px] text-white/40">Ваш аккаунт активирован. Теперь вы можете войти в систему.</p>
          <Button onClick={() => navigate('/login')} className="w-full">Войти</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="max-w-sm w-full space-y-4 p-6">
        <h1 className="text-[20px] font-bold text-white">Принять приглашение</h1>
        <p className="text-[14px] text-white/40">Заполните данные для входа в систему</p>
        <Input label="Ваше имя" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов Иван" />
        <Input label="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
        {mutation.isError && <p className="text-[13px] text-rose-400">Не удалось принять приглашение</p>}
        <Button onClick={() => mutation.mutate()} disabled={!fullName || !password || mutation.isPending} className="w-full">
          {mutation.isPending ? 'Принятие...' : 'Принять приглашение'}
        </Button>
      </Card>
    </div>
  );
}
