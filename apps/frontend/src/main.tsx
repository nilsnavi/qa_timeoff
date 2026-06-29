import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Providers } from './app/providers';
import './styles.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
    enabled: import.meta.env.PROD,
    ignoreErrors: [
      'Network Error',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      /^ResizeObserver loop/,
    ],
    beforeSend(event) {
      if (event.exception?.values?.[0]?.value?.includes('401')) {
        return null;
      }
      return event;
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
          <h2>Что-то пошло не так</h2>
          <p style={{ opacity: 0.6, marginBottom: '1rem' }}>
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </p>
          <button onClick={resetError}>Попробовать снова</button>
        </div>
      )}
      showDialog={false}
    >
      <Providers />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
