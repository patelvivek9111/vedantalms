/**
 * Phase 5 — Canvas-style extra credit.
 */
const {
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  isExtraCreditAssignment,
  isExtraCreditGroup,
  applyExtraCreditToCourseTotal,
  GRADING_ENGINE_VERSION,
} = require('../../utils/gradeCalculation');
const { cp24ExtraCreditBaseline } = require('./canvasParity.fixtures');
const {
  POLICY_NOW,
  STUDENT_ID,
  buildCourse,
  buildAssignment,
  buildGrades,
  buildSubmissions,
  case1StandardWeighted,
} = require('./fixtures');

describe('extraCredit — engine version', () => {
  it('bumps to 1.2.0 for extra credit', () => {
    expect(GRADING_ENGINE_VERSION).toBe('1.3.0');
  });
});

describe('extraCredit — helpers', () => {
  it('detects assignment flag', () => {
    expect(isExtraCreditAssignment({ isExtraCredit: true }, [])).toBe(true);
    expect(isExtraCreditAssignment({ isExtraCredit: false }, [])).toBe(false);
  });

  it('detects extra credit group', () => {
    const groups = [{ name: 'Bonus', weight: 0, isExtraCreditGroup: true }];
    expect(isExtraCreditAssignment({ group: 'Bonus' }, groups)).toBe(true);
    expect(isExtraCreditGroup(groups[0])).toBe(true);
  });

  it('applies bonus as percent of regular possible', () => {
    expect(applyExtraCreditToCourseTotal(100, 10, 100, null)).toBeCloseTo(110, 5);
    expect(applyExtraCreditToCourseTotal(80, 10, 100, null)).toBeCloseTo(90, 5);
  });

  it('does not cap bonus when capPercent is null', () => {
    const policy = { extraCredit: { enabled: true, capPercent: null } };
    expect(applyExtraCreditToCourseTotal(100, 10, 100, policy)).toBeCloseTo(110, 5);
  });

  it('respects capPercent policy', () => {
    const policy = { extraCredit: { enabled: true, capPercent: 5 } };
    expect(applyExtraCreditToCourseTotal(100, 10, 100, policy)).toBeCloseTo(105, 5);
  });

  it('skips bonus when disabled', () => {
    const policy = { extraCredit: { enabled: false } };
    expect(applyExtraCreditToCourseTotal(100, 10, 100, policy)).toBe(100);
  });
});

describe('extraCredit — CP-24 baseline', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('current grade reaches 110% with full regular + EC', () => {
    const scenario = cp24ExtraCreditBaseline();
    const percent = calculateCurrentGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    expect(percent).toBeCloseTo(110, 5);
  });

  it('projected final grade includes EC bonus', () => {
    const scenario = cp24ExtraCreditBaseline();
    const percent = calculateProjectedFinalGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions
    );
    expect(percent).toBeCloseTo(110, 5);
  });
});

describe('extraCredit — backwards compatibility (Cases 1–9)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

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

  it('regular assignments without EC flag behave as before', () => {
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
    expect(percent).toBeCloseTo((80 + 10) / (100 + 10) * 100, 5);
  });
});
