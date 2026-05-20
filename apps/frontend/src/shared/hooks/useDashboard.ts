import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { mockDashboard } from '../api/mocks';

export function useDashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
    enabled: !!localStorage.getItem('qa-timeoff-token'),
  });

  return {
    ...query,
    dashboard: query.data ?? mockDashboard,
  };
}
