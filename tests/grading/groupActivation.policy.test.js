/**
 * Assignment group activation (Phase 2) — Canvas-style current grade rules.
 */
const {
  createGroupTotals,
  isAssignmentGroupActive,
  assignmentContributesToGrade,
  applyAssignmentToGroupTotals,
} = require('../../shared/grading/groupActivation.cjs');
const { calculateFinalGradeWithWeightedGroups } = require('../../utils/gradeCalculation');
const {
  POLICY_NOW,
  PAST_DUE,
  FUTURE_DUE,
  buildCourse,
  buildAssignment,
  buildGrades,
  buildSubmissions,
  STUDENT_ID,
  EXCUSED_GRADE,
} = require('./fixtures');
const { BASELINE_SCENARIOS } = require('./canvasParity.fixtures');

describe('groupActivation — isAssignmentGroupActive', () => {
  it('returns false for empty totals', () => {
    expect(isAssignmentGroupActive(createGroupTotals())).toBe(false);
  });

  it('returns true when graded work contributed', () => {
    const totals = { earned: 80, possible: 100, hasGradedAssignments: true };
    expect(isAssignmentGroupActive(totals)).toBe(true);
  });

  it('returns true when graded zero contributed', () => {
    const totals = { earned: 0, possible: 100, hasGradedAssignments: true };
    expect(isAssignmentGroupActive(totals)).toBe(true);
  });

  it('returns false when hasGradedAssignments but possible is 0', () => {
    expect(isAssignmentGroupActive({ earned: 0, possible: 0, hasGradedAssignments: true })).toBe(
      false
    );
  });
});

describe('groupActivation — assignmentContributesToGrade', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const sid = STUDENT_ID;
  const now = POLICY_NOW;
  const policy = {};

  it('returns contribution for numeric grade (including 0)', () => {
    const assignment = buildAssignment({ id: 'a-zero', group: 'G' });
    const grades = buildGrades(sid, { 'a-zero': 0 });
    expect(
      assignmentContributesToGrade(assignment, sid, grades, buildSubmissions({ 'a-zero': true }), now, policy)
    ).toEqual({ earned: 0, possible: 100, isExtraCredit: false });
  });

  it('returns null for unpublished assignment', () => {
    const assignment = buildAssignment({ id: 'a-hidden', group: 'G', published: false });
    const grades = buildGrades(sid, { 'a-hidden': 50 });
    expect(
      assignmentContributesToGrade(assignment, sid, grades, {}, now, policy)
    ).toBeNull();
  });

  it('returns null for excused assignment', () => {
    const assignment = buildAssignment({ id: 'a-exc', group: 'G' });
    const grades = buildGrades(sid, { 'a-exc': EXCUSED_GRADE });
    expect(
      assignmentContributesToGrade(
        assignment,
        sid,
        grades,
        buildSubmissions({ 'a-exc': { excused: true } }),
        now,
        policy
      )
    ).toBeNull();
  });

  it('returns null for future-due ungraded assignment', () => {
    const assignment = buildAssignment({ id: 'a-future', group: 'G', dueDate: FUTURE_DUE });
    expect(
      assignmentContributesToGrade(assignment, sid, buildGrades(sid, {}), {}, now, policy)
    ).toBeNull();
  });

  it('count_as_zero current: submitted-but-ungraded past due excluded from current', () => {
    const assignment = buildAssignment({ id: 'a-pending', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(
        assignment,
        sid,
        buildGrades(sid, {}),
        buildSubmissions({ 'a-pending': true }),
        now,
        { missingAssignment: { mode: 'count_as_zero' } }
      )
    ).toBeNull();
  });

  it('count_as_zero final: submitted-but-ungraded past due counts as zero', () => {
    const assignment = buildAssignment({ id: 'a-pending', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(
        assignment,
        sid,
        buildGrades(sid, {}),
        buildSubmissions({ 'a-pending': true }),
        now,
        { missingAssignment: { mode: 'count_as_zero' } },
        'final'
      )
    ).toEqual({ earned: 0, possible: 100, isExtraCredit: false });
  });

  it('exclude_until_graded: submitted-but-ungraded past due stays excluded', () => {
    const assignment = buildAssignment({ id: 'a-pending', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(
        assignment,
        sid,
        buildGrades(sid, {}),
        buildSubmissions({ 'a-pending': true }),
        now,
        { missingAssignment: { mode: 'exclude_until_graded' } }
      )
    ).toBeNull();
  });

  it('returns missing-as-zero for past-due with no submission', () => {
    const assignment = buildAssignment({ id: 'a-missing', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(assignment, sid, buildGrades(sid, {}), {}, now, policy)
    ).toEqual({ earned: 0, possible: 100, isExtraCredit: false });
  });

  it('returns null for missing when exclude_until_graded', () => {
    const assignment = buildAssignment({ id: 'a-missing', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(assignment, sid, buildGrades(sid, {}), {}, now, {
        missingAssignment: { mode: 'exclude_until_graded' },
      })
    ).toBeNull();
  });

  it('exclude_until_graded: past-due missing excluded in final mode (same as current)', () => {
    const assignment = buildAssignment({ id: 'a-missing', group: 'G', dueDate: PAST_DUE });
    expect(
      assignmentContributesToGrade(
        assignment,
        sid,
        buildGrades(sid, {}),
        {},
        now,
        { missingAssignment: { mode: 'exclude_until_graded' } },
        'final'
      )
    ).toBeNull();
  });

  it('throws for unsupported gradeMode', () => {
    const assignment = buildAssignment({ id: 'a1', group: 'G' });
    expect(() =>
      assignmentContributesToGrade(assignment, sid, buildGrades(sid, { a1: 80 }), {}, now, policy, 'invalid')
    ).toThrow(/Unsupported gradeMode/);
  });
});

describe('groupActivation — applyAssignmentToGroupTotals activates group', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('sets hasGradedAssignments when assignment contributes', () => {
    const totals = createGroupTotals();
    const assignment = buildAssignment({ id: 'a1', group: 'G' });
    applyAssignmentToGroupTotals(
      assignment,
      STUDENT_ID,
      buildGrades(STUDENT_ID, { a1: 75 }),
      buildSubmissions({ a1: true }),
      POLICY_NOW,
      totals,
      {}
    );
    expect(isAssignmentGroupActive(totals)).toBe(true);
    expect(totals.earned).toBe(75);
    expect(totals.possible).toBe(100);
  });
});

describe('groupActivation — parity with calculateFinalGradeWithWeightedGroups', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it.each(BASELINE_SCENARIOS.map((f) => [f().id, f]))(
    '%s unchanged after groupActivation refactor',
    (_id, factory) => {
      const s = factory();
      const percent = calculateFinalGradeWithWeightedGroups(
        s.studentId,
        s.course,
        s.assignments,
        s.grades,
        s.submissions,
        s.policyOverride || null
      );

      if (s.assertLessThan != null) {
        expect(percent).toBeLessThan(s.assertLessThan);
        return;
      }

      if (s.assertLessThanUncapped) {
        const uncapped = calculateFinalGradeWithWeightedGroups(
          s.studentId,
          s.course,
          s.assignments,
          s.grades,
          s.submissions,
          null
        );
        expect(percent).toBeLessThan(uncapped);
        return;
      }

      expect(percent).toBeCloseTo(s.expectedCurrentPercent, 5);
    }
  );
});
