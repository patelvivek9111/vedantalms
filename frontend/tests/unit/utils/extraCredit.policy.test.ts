/**
 * Phase 5 — Canvas-style extra credit (frontend mirror).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  isExtraCreditAssignment,
  isExtraCreditGroup,
  applyExtraCreditToCourseTotal,
  GRADING_ENGINE_VERSION,
} from '@/utils/gradeUtils';
import { cp24ExtraCreditBaseline } from '@tests/fixtures/grading/canvasParity.fixtures';
import {
  STUDENT_ID,
  buildCourse,
  buildAssignment,
  buildGrades,
  case1StandardWeighted,
} from '@tests/fixtures/grading/fixtures';

function buildSubmissions(entries: Record<string, unknown | boolean>) {
  const map: Record<string, unknown> = {};
  for (const [assignmentId, sub] of Object.entries(entries)) {
    map[String(assignmentId)] = sub === true ? { _id: `sub-${assignmentId}` } : sub;
  }
  return map;
}

describe('extraCredit — engine version (frontend)', () => {
  it('bumps to 1.2.0 for extra credit', () => {
    expect(GRADING_ENGINE_VERSION).toBe('1.3.0');
  });
});

describe('extraCredit — helpers (frontend)', () => {
  it('detects assignment flag and group', () => {
    expect(isExtraCreditAssignment({ isExtraCredit: true }, [])).toBe(true);
    const groups = [{ name: 'Bonus', weight: 0, isExtraCreditGroup: true }];
    expect(isExtraCreditAssignment({ group: 'Bonus' }, groups)).toBe(true);
    expect(isExtraCreditGroup(groups[0])).toBe(true);
  });

  it('applies bonus and cap', () => {
    expect(applyExtraCreditToCourseTotal(100, 10, 100, null)).toBeCloseTo(110, 5);
    const nullCapPolicy = { extraCredit: { enabled: true, capPercent: null } };
    expect(applyExtraCreditToCourseTotal(100, 10, 100, nullCapPolicy)).toBeCloseTo(110, 5);
    const policy = { extraCredit: { enabled: true, capPercent: 5 } };
    expect(applyExtraCreditToCourseTotal(100, 10, 100, policy)).toBeCloseTo(105, 5);
  });
});

describe('extraCredit — CP-24 baseline (frontend)', () => {
  it('current and final grades reach 110%', () => {
    const scenario = cp24ExtraCreditBaseline();
    const current = calculateCurrentGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    const finalGrade = calculateProjectedFinalGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    expect(current).toBeCloseTo(110, 5);
    expect(finalGrade).toBeCloseTo(110, 5);
  });
});

describe('extraCredit — backwards compatibility (frontend)', () => {
  it('Case 1 unchanged without EC flags', () => {
    const scenario = case1StandardWeighted();
    const percent = calculateCurrentGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    expect(percent).toBeCloseTo(scenario.expectedPercent, 5);
  });

  it('non-EC assignments use combined denominator', () => {
    const regularId = 'ec-regular';
    const otherId = 'ec-other';
    const course = buildCourse([{ name: 'G', weight: 100 }]);
    const assignments = [
      buildAssignment({ id: regularId, group: 'G' }),
      buildAssignment({ id: otherId, group: 'G', totalPoints: 10 }),
    ];
    const grades = buildGrades(STUDENT_ID, { [regularId]: 80, [otherId]: 10 });
    const submissions = buildSubmissions({ [regularId]: true, [otherId]: true });
    const percent = calculateCurrentGradeWithWeightedGroups(
      STUDENT_ID,
      course,
      assignments,
      grades,
      submissions
    );
    expect(percent).toBeCloseTo(((80 + 10) / (100 + 10)) * 100, 5);
  });
});
