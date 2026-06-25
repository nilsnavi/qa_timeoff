export async function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem('qa-timeoff-token');
  const apiUrl = import.meta.env.VITE_API_URL ?? '/api';

  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error(`Export failed: ${response.status}`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
