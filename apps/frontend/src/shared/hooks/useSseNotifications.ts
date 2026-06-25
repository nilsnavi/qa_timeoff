import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showAppToast } from '../utils';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const RETRY_DELAYS = [3000, 6000, 12000, 30000]; // ms

export function useSseNotifications(token: string | null) {
  const queryClient = useQueryClient();
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const esRef = useRef<EventSource>();

  useEffect(() => {
    if (!token) return;

    function connect() {
      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource(
        `${API_URL}/sse/leave-requests?token=${encodeURIComponent(token!)}`,
      );
      esRef.current = es;

      es.onmessage = (event) => {
        retryRef.current = 0;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') return;

          if (data.type?.includes('TIMEOFF') || data.type?.includes('VACATION')) {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['timeoff'] });
            queryClient.invalidateQueries({ queryKey: ['vacation'] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
          }

          if (data.message) {
            const tone = data.type?.includes('REJECTED') ? 'error' : 'success';
            showAppToast(data.message, undefined, tone);
          }
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = undefined;

        const delay = RETRY_DELAYS[Math.min(retryRef.current, RETRY_DELAYS.length - 1)];
        retryRef.current += 1;

        timerRef.current = setTimeout(() => {
          if (navigator.onLine) {
            connect();
          } else {
            window.addEventListener('online', connect, { once: true });
          }
        }, delay);
      };
    }

    connect();

    const handleOnline = () => {
      retryRef.current = 0;
      connect();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('online', handleOnline);
      esRef.current?.close();
      esRef.current = undefined;
    };
  }, [token, queryClient]);
}
