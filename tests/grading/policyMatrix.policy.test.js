const {
  calculateFinalGradeWithWeightedGroups,
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  getLetterGrade,
} = require('../../shared/grading/gradeCalculation.cjs');
const { resolveGradingPolicy, courseContextFromResolvedPolicy } = require('../../shared/grading/policyResolver.cjs');
const { cp25SubmittedUngradedFinalGap, POLICY_NOW } = require('./canvasParity.fixtures');
const { runCurrentGrade, runFinalGrade } = require('./parityRunner');

const PAST_DUE = '2020-06-01T00:00:00.000Z';
const LATE = '2020-06-10T00:00:00.000Z';

function buildScenario(overrides = {}) {
  const course = { groups: [{ name: 'Assignments', weight: 100 }] };
  const assignments = [
    {
      _id: 'a1',
      group: 'Assignments',
      totalPoints: 100,
      questions: [{ points: 100 }],
      published: true,
      dueDate: PAST_DUE,
    },
    {
      _id: 'a2',
      group: 'Assignments',
      totalPoints: 100,
      questions: [{ points: 100 }],
      published: true,
      dueDate: PAST_DUE,
    },
  ];
  const sid = 's1';
  const grades = { [sid]: { a1: 80, a2: 60 } };
  const submissions = {
    a1: { submittedAt: PAST_DUE },
    a2: { submittedAt: LATE },
  };
  return { course, assignments, sid, grades, submissions, ...overrides };
}

function runWithPolicy(course, policyExtra, scenario) {
  const resolved = resolveGradingPolicy({
    course,
    coursePolicy: { policy: policyExtra },
  });
  const ctx = courseContextFromResolvedPolicy(resolved);
  return calculateFinalGradeWithWeightedGroups(
    scenario.sid,
    ctx,
    scenario.assignments,
    scenario.grades,
    scenario.submissions,
    resolved
  );
}

describe('Policy matrix', () => {
  it('baseline: 70% with no policies', () => {
    const s = buildScenario();
    const pct = runWithPolicy(s.course, {}, s);
    expect(pct).toBeCloseTo(70, 5);
  });

  it('late penalty per_day reduces overall', () => {
    const s = buildScenario();
    const withLate = runWithPolicy(s.course, {
      latePenalty: { enabled: true, mode: 'per_day', perDayPercent: 10, gracePeriodHours: 0, capPercent: 50 },
    }, s);
    expect(withLate).toBeLessThan(70);
  });

  it('drop lowest removes 60% assignment → 80%', () => {
    const s = buildScenario();
    const pct = runWithPolicy(s.course, {
      dropLowest: { enabled: true, rules: [{ groupName: 'Assignments', count: 1 }] },
    }, s);
    expect(pct).toBeCloseTo(80, 5);
  });

  it('exclude missing raises grade when one item ungraded and past due', () => {
    const s = buildScenario();
    s.grades = { [s.sid]: { a1: 80 } };
    s.submissions = { a1: { submittedAt: PAST_DUE } };
    const excluded = runWithPolicy(s.course, {
      missingAssignment: { mode: 'exclude_until_graded' },
    }, s);
    expect(excluded).toBeCloseTo(80, 5);
  });

  it('category cap limits group contribution', () => {
    const course = {
      groups: [
        { name: 'A', weight: 80 },
        { name: 'B', weight: 20 },
      ],
    };
    const assignments = [
      { _id: 'g1', group: 'A', totalPoints: 100, questions: [{ points: 100 }], published: true, dueDate: PAST_DUE },
      { _id: 'g2', group: 'B', totalPoints: 100, questions: [{ points: 100 }], published: true, dueDate: PAST_DUE },
    ];
    const sid = 's1';
    const grades = { [sid]: { g1: 100, g2: 0 } };
    const submissions = { g1: {}, g2: {} };
    const capped = runWithPolicy(
      course,
      { categoryCaps: { enabled: true, caps: [{ groupName: 'A', maxWeightPercent: 50 }] } },
      { course, assignments, sid, grades, submissions }
    );
    const uncapped = runWithPolicy(course, {}, { course, assignments, sid, grades, submissions });
    expect(capped).toBeLessThan(uncapped);
  });

  it('getLetterGrade respects custom scale from resolved policy', () => {
    const scale = [
      { letter: 'A', min: 95, max: 100 },
      { letter: 'F', min: 0, max: 94 },
    ];
    expect(getLetterGrade(94, scale)).toBe('F');
    expect(getLetterGrade(95, scale)).toBe('A');
  });

  it('count_as_zero current excludes ungraded submitted; final counts as zero (CP-25)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
    const scenario = cp25SubmittedUngradedFinalGap();
    expect(runCurrentGrade(scenario)).toBeCloseTo(80, 5);
    expect(runFinalGrade(scenario)).toBeCloseTo(40, 5);
    jest.useRealTimers();
  });
});
