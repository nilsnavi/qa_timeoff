import { useQuery } from '@tanstack/react-query';
import type { Dashboard } from '../types';
import { api } from '../api';

/**
 * Returns the shared dashboard query.
 * NOTE: `dashboard` is guaranteed to be defined at render time because
 * AppLayout gates children rendering until the query resolves.
 */
export function useDashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  return {
    ...query,
    dashboard: (query.data ?? {}) as Dashboard,
  };
}
