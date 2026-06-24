import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { Button, Card } from '../components/ui';

export function FallbackPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Неизвестная ошибка';

  return (
    <main className="mx-auto grid min-h-[var(--tg-viewport-height)] w-full max-w-xl place-items-center px-4 safe-area">
      <Card className="w-full text-center">
        <div className="grid gap-4">
          <AlertTriangle className="mx-auto text-rose-500" size={38} />
          <div>
            <h1 className="text-xl font-black text-white">Экран недоступен</h1>
            <p className="mt-2 text-sm font-bold text-[#7A8599]">{message}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Обновить
            </Button>
            <Button onClick={() => navigate('/')}>На главную</Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
