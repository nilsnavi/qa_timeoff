import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../../shared/api';

export function JiraIssuePicker({
  selected, onSelect, manualKey, onManualKeyChange,
}: {
  selected: any | null;
  onSelect: (issue: any | null) => void;
  manualKey: string;
  onManualKeyChange: (key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'manual'>('search');

  const searchQuery = useQuery({
    queryKey: ['jira', 'issues', 'search', query],
    queryFn: () => api.jiraSearchIssues(query),
    enabled: query.length >= 2,
  });

  if (selected) {
    return (
      <div className="field-shell">
        <span className="field-label">Задача</span>
        <div className="flex items-center justify-between rounded-[10px] border border-[#4C7DFF]/30 bg-[#4C7DFF]/10 px-3 py-2.5">
          <span className="text-[14px] text-white/80"><b className="text-[#4C7DFF]">{selected.issueKey}</b> — {selected.summary}</span>
          <button onClick={() => onSelect(null)} className="text-[13px] text-white/30 hover:text-white/60">×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="field-shell">
      <div className="flex items-center justify-between mb-1.5">
        <span className="field-label">Задача Jira</span>
        <button
          type="button"
          onClick={() => setMode(m => m === 'search' ? 'manual' : 'search')}
          className="text-[12px] text-[#4C7DFF] hover:text-[#6B96FF]"
        >
          {mode === 'search' ? 'Ввести ключ вручную' : 'Найти задачу'}
        </button>
      </div>

      {mode === 'search' ? (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Введите ключ или название задачи..."
            className="field-input pl-9"
          />
          {searchQuery.data && searchQuery.data.length > 0 && (
            <div className="absolute z-10 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#0F1829] shadow-lg">
              {searchQuery.data.map((issue: any) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => { onSelect(issue); setQuery(''); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.06]"
                >
                  <span className="text-[13px] font-bold text-[#4C7DFF] shrink-0">{issue.issueKey}</span>
                  <span className="text-[13px] text-white/70 truncate">{issue.summary}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <input
          value={manualKey}
          onChange={e => onManualKeyChange(e.target.value.toUpperCase())}
          placeholder="QA-123"
          className="field-input"
        />
      )}
    </div>
  );
}
