import { describe, it, expect } from 'vitest';
import { getLetterGrade } from '../gradeUtils';

describe('What-If letter grade parity (P1)', () => {
  const defaultScale = [
    { letter: 'A', min: 90, max: 100 },
    { letter: 'B', min: 80, max: 89 },
    { letter: 'F', min: 0, max: 59 },
  ];

  it('89.99 → B, 90 → A (inclusive lower bound)', () => {
    expect(getLetterGrade(89.99, defaultScale)).toBe('B');
    expect(getLetterGrade(90, defaultScale)).toBe('A');
  });

  it('respects custom course grade scale', () => {
    const custom = [
      { letter: 'A', min: 95, max: 100 },
      { letter: 'B', min: 85, max: 94 },
      { letter: 'F', min: 0, max: 84 },
    ];
    expect(getLetterGrade(94, custom)).toBe('B');
    expect(getLetterGrade(95, custom)).toBe('A');
  });
});
