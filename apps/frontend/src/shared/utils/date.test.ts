import { describe, expect, it } from 'vitest';
import { toDateInputValue } from './date';

describe('toDateInputValue', () => {
  it('возвращает дату в формате YYYY-MM-DD', () => {
    const result = toDateInputValue(new Date('2026-01-15T12:30:00.000Z'));

    expect(result).toBe('2026-01-15');
  });
});

