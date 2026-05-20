export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData ?? '';
}

export function setupTelegramApp() {
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  tg?.setHeaderColor?.('#eef6ff');
  tg?.setBackgroundColor?.('#eef6ff');
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready: () => void;
        expand: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}
