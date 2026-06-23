import { useEffect } from 'react';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';
type TelegramPopupButton = {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
};

/**
 * In dev mode, initData can be provided via:
 *   1. URL query param `?__dev_init=...`
 *   2. localStorage key `qa-timeoff-dev-init`
 *   3. A prompt in the UI (handled by AppLayout)
 *
 * The mock Telegram.WebApp is also set up to prevent crashes
 * from setupTelegramApp() and other Telegram API calls.
 */
export function getTelegramInitData(): string {
  // 1. Try real Telegram WebApp first
  const real = window.Telegram?.WebApp?.initData;
  if (real) return real;

  // 2. Dev mode fallback: URL param
  if (import.meta.env.DEV) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlInit = urlParams.get('__dev_init');
    if (urlInit) {
      localStorage.setItem('qa-timeoff-dev-init', urlInit);
      return urlInit;
    }

    // 3. Dev mode fallback: localStorage
    const stored = localStorage.getItem('qa-timeoff-dev-init');
    if (stored) return stored;
  }

  return '';
}

export function setupTelegramApp() {
  ensureMockTelegram();
  const tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  tg?.enableClosingConfirmation?.();
  syncTelegramTheme();
  syncTelegramViewport();

  tg?.onEvent?.('themeChanged', syncTelegramTheme);
  tg?.onEvent?.('viewportChanged', syncTelegramViewport);
}

export function cleanupTelegramApp() {
  const tg = window.Telegram?.WebApp;
  tg?.offEvent?.('themeChanged', syncTelegramTheme);
  tg?.offEvent?.('viewportChanged', syncTelegramViewport);
}

export function hapticImpact(style: HapticStyle = 'light') {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
}

export function hapticNotification(type: HapticNotification) {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
}

export function hapticSelection() {
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
}

export function showTelegramPopup({
  title,
  message,
  buttons,
}: {
  title: string;
  message: string;
  buttons: TelegramPopupButton[];
}) {
  const tg = window.Telegram?.WebApp;

  const showPopup = tg?.showPopup;
  if (!showPopup) {
    return Promise.resolve(window.confirm(message) ? 'confirm' : 'cancel');
  }

  return new Promise<string>((resolve) => {
    showPopup({ title, message, buttons }, (buttonId) => resolve(buttonId || ''));
  });
}

export async function confirmTelegram(title: string, message: string) {
  const result = await showTelegramPopup({
    title,
    message,
    buttons: [
      { id: 'cancel', type: 'cancel', text: 'Отмена' },
      { id: 'confirm', type: 'destructive', text: 'Подтвердить' },
    ],
  });

  return result === 'confirm';
}

export function showAppToast(title: string, message?: string, tone: 'success' | 'error' | 'info' = 'success') {
  window.dispatchEvent(new CustomEvent('qa-timeoff-toast', { detail: { title, message, tone } }));
  hapticNotification(tone === 'error' ? 'error' : 'success');
}

export function useTelegramBackButton(visible: boolean, onClick: () => void) {
  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) {
      return;
    }

    if (visible) {
      backButton.show();
      backButton.onClick(onClick);
    } else {
      backButton.hide();
    }

    return () => {
      backButton.offClick(onClick);
    };
  }, [onClick, visible]);
}

export function useTelegramMainButton({
  text,
  visible,
  disabled,
  loading,
  onClick,
}: {
  text: string;
  visible: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  useEffect(() => {
    const mainButton = window.Telegram?.WebApp?.MainButton;
    if (!mainButton) {
      return;
    }

    mainButton.setText(text);
    if (disabled) {
      mainButton.disable();
    } else {
      mainButton.enable();
    }
    if (loading) {
      mainButton.showProgress(false);
    } else {
      mainButton.hideProgress();
    }
    if (visible) {
      mainButton.show();
    } else {
      mainButton.hide();
    }
    mainButton.onClick(onClick);

    return () => {
      mainButton.offClick(onClick);
      mainButton.hideProgress();
      mainButton.hide();
    };
  }, [disabled, loading, onClick, text, visible]);
}

function syncTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  const params = tg?.themeParams;
  const root = document.documentElement;

  if (params?.bg_color) {
    root.style.setProperty('--app-bg', params.bg_color);
  }
  if (params?.text_color) {
    root.style.setProperty('--app-text', params.text_color);
  }
  if (params?.hint_color) {
    root.style.setProperty('--app-muted', params.hint_color);
  }
  if (params?.secondary_bg_color) {
    root.style.setProperty('--app-surface', hexToRgba(params.secondary_bg_color, 0.76));
    root.style.setProperty('--app-surface-strong', hexToRgba(params.secondary_bg_color, 0.94));
  }
  if (params?.button_color) {
    root.style.setProperty('--app-gradient', `linear-gradient(135deg, ${params.button_color} 0%, #2563eb 100%)`);
  }

  tg?.setHeaderColor?.(params?.bg_color ?? '#eef6ff');
  tg?.setBackgroundColor?.(params?.bg_color ?? '#eef6ff');
}

function syncTelegramViewport() {
  const tg = window.Telegram?.WebApp;
  const height = tg?.viewportStableHeight || tg?.viewportHeight || window.innerHeight;
  const safeInset = tg?.safeAreaInset;
  const contentInset = tg?.contentSafeAreaInset;

  document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--tg-safe-top', `${safeInset?.top ?? contentInset?.top ?? 0}px`);
  document.documentElement.style.setProperty('--tg-safe-right', `${safeInset?.right ?? contentInset?.right ?? 0}px`);
  document.documentElement.style.setProperty('--tg-safe-bottom', `${safeInset?.bottom ?? contentInset?.bottom ?? 0}px`);
  document.documentElement.style.setProperty('--tg-safe-left', `${safeInset?.left ?? contentInset?.left ?? 0}px`);
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureMockTelegram() {
  if (window.Telegram?.WebApp) return; // already exists (real or mocked)

  if (!import.meta.env.DEV) return; // only mock in development

  const mockWebApp: NonNullable<Window['Telegram']>['WebApp'] = {
    initData: '',
    initDataUnsafe: {},
    version: 'dev',
    platform: 'dev',
    colorScheme: 'light',
    isExpanded: true,
    themeParams: {
      bg_color: '#eef6ff',
      text_color: '#020617',
      hint_color: '#94a3b8',
      secondary_bg_color: '#ffffff',
      button_color: '#3b82f6',
    },
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,
    safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
    contentSafeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
    ready: () => {},
    expand: () => {},
    enableClosingConfirmation: () => {},
    setHeaderColor: () => {},
    setBackgroundColor: () => {},
    onEvent: () => {},
    offEvent: () => {},
    showPopup: (_params, callback) => callback?.(''),
    HapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
      selectionChanged: () => {},
    },
    MainButton: {
      setText: () => {},
      show: () => {},
      hide: () => {},
      enable: () => {},
      disable: () => {},
      showProgress: () => {},
      hideProgress: () => {},
      onClick: () => {},
      offClick: () => {},
    },
    BackButton: {
      show: () => {},
      hide: () => {},
      onClick: () => {},
      offClick: () => {},
    },
  };

  window.Telegram = { WebApp: mockWebApp };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: Record<string, any>;
        version?: string;
        platform?: string;
        colorScheme?: string;
        isExpanded?: boolean;
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          secondary_bg_color?: string;
          button_color?: string;
        };
        viewportHeight?: number;
        viewportStableHeight?: number;
        safeAreaInset?: { top: number; right: number; bottom: number; left: number };
        contentSafeAreaInset?: { top: number; right: number; bottom: number; left: number };
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        onEvent?: (event: 'themeChanged' | 'viewportChanged', callback: () => void) => void;
        offEvent?: (event: 'themeChanged' | 'viewportChanged', callback: () => void) => void;
        showPopup?: (
          params: { title: string; message: string; buttons: TelegramPopupButton[] },
          callback?: (buttonId: string) => void,
        ) => void;
        HapticFeedback?: {
          impactOccurred?: (style: HapticStyle) => void;
          notificationOccurred?: (type: HapticNotification) => void;
          selectionChanged?: () => void;
        };
        MainButton?: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
      };
    };
  }
}
