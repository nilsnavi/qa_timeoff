import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { showAppToast } from '../utils';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export function useSseNotifications(token: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`${API_URL}/sse/leave-requests?token=${encodeURIComponent(token)}`);

    es.onmessage = (event) => {
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
    };

    return () => es.close();
  }, [token, queryClient]);
}
