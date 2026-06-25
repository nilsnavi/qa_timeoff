import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../shared/hooks/useDashboard';

interface SearchResult {
  type: 'user' | 'request';
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { dashboard } = useDashboard();

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();

    const requestResults: SearchResult[] = [
      ...dashboard.requests.filter(r => (r.reason ?? '').toLowerCase().includes(q)),
      ...(dashboard.vacations ?? []).filter(v => (v.comment ?? '').toLowerCase().includes(q)),
    ]
      .slice(0, 5)
      .map(r => ({
        type: 'request' as const,
        id: r.id,
        title: 'reason' in r ? (r as any).reason : 'Отпуск',
        subtitle: r.status,
        path: '/requests/my',
      }));

    return requestResults;
  }, [query, dashboard]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#111A2E] border border-white/10 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search size={16} className="text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск заявок..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.length >= 2 && (
            <p className="px-4 py-6 text-center text-sm text-white/30">Ничего не найдено</p>
          )}
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => { navigate(r.path); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] text-left"
            >
              <span className="text-sm font-semibold text-white">{r.title}</span>
              <span className="text-xs text-white/40 ml-auto">{r.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
