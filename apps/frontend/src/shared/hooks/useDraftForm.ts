import { useCallback, useState } from 'react';

export function useDraftForm<T extends Record<string, unknown>>(
  key: string,
  initial: T,
): [T, (updater: Partial<T>) => void, () => void] {
  const stored = localStorage.getItem(key);
  const [form, setFormState] = useState<T>(() => {
    try {
      return stored ? { ...initial, ...JSON.parse(stored) } : initial;
    } catch {
      return initial;
    }
  });

  const setForm = useCallback(
    (updater: Partial<T>) => {
      setFormState((prev) => {
        const next = { ...prev, ...updater };
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return [form, setForm, clearDraft];
}
