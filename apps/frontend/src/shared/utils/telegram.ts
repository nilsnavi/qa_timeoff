import { useEffect } from 'react';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';
type TelegramPopupButton = {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
};

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
}

export function useTelegramBackButton(visible: boolean, onClick: () => void) {
  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;

    if (visible) {
      backButton.show();
    } else {
      backButton.hide();
    }

    backButton.onClick(onClick);

    return () => {
      backButton.offClick(onClick);
      backButton.hide();
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
