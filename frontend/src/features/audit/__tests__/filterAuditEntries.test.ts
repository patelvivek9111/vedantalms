import { describe, expect, it } from 'vitest';
import { filterTimelineEntries } from '../filterAuditEntries';

describe('filterAuditEntries', () => {
  const entries = [
    {
      id: '1',
      at: '2025-01-01',
      category: 'lifecycle',
      action: 'finalize',
      summary: 'Finalized term',
      severity: 'info',
    },
    {
      id: '2',
      at: '2025-01-02',
      category: 'policy',
      action: 'update',
      summary: 'Policy changed',
      severity: 'warning',
    },
  ];

  it('filters by category and search', () => {
    const filtered = filterTimelineEntries(entries, {
      search: 'policy',
      category: 'policy',
      severity: '',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });
});
