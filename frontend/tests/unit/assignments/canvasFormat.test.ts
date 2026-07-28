import { describe, expect, it } from 'vitest';
import {
  getEffectiveLockAt,
  resolveCanvasAvailability,
} from '../../../src/components/assignments/canvas/canvasFormat';

const now = new Date('2026-01-15T12:00:00.000Z');

describe('canvasFormat availability', () => {
  it('returns locked_manual when teacher locked the assignment', () => {
    expect(
      resolveCanvasAvailability(
        {
          availableFrom: '2026-01-01T00:00:00.000Z',
          dueDate: '2026-02-01T00:00:00.000Z',
          locked: true,
        },
        now
      )
    ).toEqual({ kind: 'locked_manual' });
  });

  it('returns locked_until before availableFrom', () => {
    const result = resolveCanvasAvailability(
      {
        availableFrom: '2026-02-01T00:00:00.000Z',
        dueDate: '2026-03-01T00:00:00.000Z',
      },
      now
    );
    expect(result.kind).toBe('locked_until');
  });

  it('uses lockAt as effective lock when set', () => {
    expect(
      getEffectiveLockAt({
        dueDate: '2026-01-10T00:00:00.000Z',
        lockAt: '2026-01-20T00:00:00.000Z',
        lockAfterDue: true,
      })?.toISOString()
    ).toBe('2026-01-20T00:00:00.000Z');

    expect(
      resolveCanvasAvailability(
        {
          availableFrom: '2026-01-01T00:00:00.000Z',
          dueDate: '2026-01-10T00:00:00.000Z',
          lockAt: '2026-01-20T00:00:00.000Z',
          lockAfterDue: false,
        },
        now
      ).kind
    ).toBe('open');
  });

  it('locks after due when lockAfterDue and no lockAt', () => {
    const result = resolveCanvasAvailability(
      {
        availableFrom: '2026-01-01T00:00:00.000Z',
        dueDate: '2026-01-01T00:00:00.000Z',
        lockAfterDue: true,
      },
      now
    );
    expect(result.kind).toBe('locked_after');
  });

  it('stays open past due when lockAfterDue is false and lockAt unset', () => {
    const result = resolveCanvasAvailability(
      {
        availableFrom: '2026-01-01T00:00:00.000Z',
        dueDate: '2026-01-01T00:00:00.000Z',
        lockAfterDue: false,
      },
      now
    );
    expect(result.kind).toBe('open');
  });
});
