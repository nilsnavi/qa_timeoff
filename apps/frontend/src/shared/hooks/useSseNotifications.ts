import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { showAppToast } from '../utils';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const RETRY_DELAYS = [3000, 6000, 12000, 30000]; // ms

export function useSseNotifications() {
  const queryClient = useQueryClient();
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const esRef = useRef<EventSource>();

  useEffect(() => {
    async function connect() {
      if (esRef.current) {
        esRef.current.close();
      }

      let sseToken: string;
      try {
        const result = await api.getSseToken();
        sseToken = result.token;
      } catch {
        // Not authenticated — nothing to connect
        return;
      }

      const es = new EventSource(
        `${API_URL}/sse/leave-requests?token=${encodeURIComponent(sseToken)}`,
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

          if (data.type === 'TIMEOFF_CREATED' || data.type === 'VACATION_CREATED') {
            queryClient.invalidateQueries({ queryKey: ['timeoff', 'pending'] });
            queryClient.invalidateQueries({ queryKey: ['vacation', 'pending'] });
            return;
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

    return () => {
      clearTimeout(timerRef.current);
      esRef.current?.close();
      esRef.current = undefined;
    };
  }, [queryClient]);
}
