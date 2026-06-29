import { getAccessToken, clearAccessToken } from '../api/client';
import { showAppToast } from './telegram';

export async function downloadCsv(path: string, filename: string) {
  const token = getAccessToken();
  const apiUrl = import.meta.env.VITE_API_URL ?? '/api';

  const response = await fetch(`${apiUrl}${path}`, {
    credentials: 'include',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (response.status === 401) {
    clearAccessToken();
    window.location.assign('/login');
    throw new Error('Unauthorized');
  }

  if (response.status === 403) {
    showAppToast('Недостаточно прав для экспорта', undefined, 'error');
    throw new Error('Forbidden');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    showAppToast(
      'Ошибка экспорта',
      text ? text.slice(0, 200) : 'Попробуйте позже',
      'error',
    );
    throw new Error(`Export failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
