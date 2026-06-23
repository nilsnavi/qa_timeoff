import '@testing-library/jest-dom';

// Mock Telegram WebApp for all tests
Object.defineProperty(window, 'Telegram', {
  value: {
    WebApp: {
      initData: '',
      initDataUnsafe: {},
      version: 'test',
      platform: 'test',
      colorScheme: 'light',
      isExpanded: true,
      themeParams: {
        bg_color: '#ffffff',
        text_color: '#000000',
        hint_color: '#999999',
        secondary_bg_color: '#f0f0f0',
        button_color: '#3b82f6',
      },
      viewportHeight: 800,
      viewportStableHeight: 800,
      safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
      contentSafeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
      ready: () => {},
      expand: () => {},
      enableClosingConfirmation: () => {},
      setHeaderColor: () => {},
      setBackgroundColor: () => {},
      onEvent: () => {},
      offEvent: () => {},
      showPopup: (_params: any, callback?: (id: string) => void) => callback?.(''),
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
    },
  },
  writable: true,
});
