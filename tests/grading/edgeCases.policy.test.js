/**
 * Edge-case hardening (P2) — shared grading must fail safely.
 */
const {
  calculateFinalGradeWithWeightedGroups,
  getWeightedGradeForStudent,
} = require('../../shared/grading/gradeCalculation.cjs');
const { EXCUSED_GRADE, buildGrades, buildCourse, buildAssignment, STUDENT_ID, PAST_DUE, FUTURE_DUE } = require('./fixtures');

const sid = STUDENT_ID;

function run(course, assignments, grades, submissions = {}) {
  const percent = calculateFinalGradeWithWeightedGroups(sid, course, assignments, grades, submissions);
  return Number.isFinite(percent) ? percent : NaN;
}

describe('Grading edge cases (shared)', () => {
  it('all assignments excused → 0%', () => {
    const groups = [{ name: 'Assignments', weight: 100 }];
    const a1 = 'assign-e1';
    const a2 = 'assign-e2';
    const assignments = [
      buildAssignment({ id: a1, group: 'Assignments' }),
      buildAssignment({ id: a2, group: 'Assignments' }),
    ];
    const grades = buildGrades(sid, { [a1]: EXCUSED_GRADE, [a2]: EXCUSED_GRADE });
    expect(run(buildCourse(groups), assignments, grades)).toBe(0);
  });

  it('all unpublished → 0%', () => {
    const groups = [{ name: 'Assignments', weight: 100 }];
    const assignments = [
      buildAssignment({ id: 'h1', group: 'Assignments', published: false }),
      buildAssignment({ id: 'h2', group: 'Assignments', published: false }),
    ];
    expect(run(buildCourse(groups), assignments, buildGrades(sid, {}))).toBe(0);
  });

  it('malformed weights (NaN) do not propagate NaN', () => {
    const course = { groups: [{ name: 'G', weight: NaN }, { name: 'H', weight: 40 }] };
    const assignments = [buildAssignment({ id: 'a1', group: 'H' })];
    const grades = buildGrades(sid, { a1: 80 });
    const percent = run(course, assignments, grades);
    expect(Number.isNaN(percent)).toBe(false);
    expect(percent).toBeCloseTo(80, 5);
  });

  it('weights not totaling 100 still compute finite result', () => {
    const course = {
      groups: [
        { name: 'A', weight: 30 },
        { name: 'B', weight: 30 },
      ],
    };
    const assignments = [
      buildAssignment({ id: 'a1', group: 'A' }),
      buildAssignment({ id: 'a2', group: 'B' }),
    ];
    const grades = buildGrades(sid, { a1: 80, a2: 60 });
    const percent = run(course, assignments, grades);
    expect(Number.isFinite(percent)).toBe(true);
    expect(percent).toBeCloseTo(70, 5);
  });

  it('negative score is finite (no crash)', () => {
    const groups = [{ name: 'Assignments', weight: 100 }];
    const assignments = [buildAssignment({ id: 'neg', group: 'Assignments' })];
    const grades = buildGrades(sid, { neg: -10 });
    const percent = run(buildCourse(groups), assignments, grades);
    expect(Number.isFinite(percent)).toBe(true);
    expect(percent).toBeCloseTo(-10, 5);
  });

  it('empty assignment groups on course → 0%', () => {
    const course = { groups: [] };
    const assignments = [buildAssignment({ id: 'u1', group: 'Other' })];
    expect(run(course, assignments, buildGrades(sid, {}))).toBe(0);
  });

  it('ungrouped assignments use remaining weight bucket', () => {
    const course = { groups: [{ name: 'Graded', weight: 50 }] };
    const assignments = [
      buildAssignment({ id: 'g1', group: 'Graded' }),
      buildAssignment({ id: 'u1', group: 'Ungrouped' }),
    ];
    const grades = buildGrades(sid, { g1: 80, u1: 100 });
    const percent = run(course, assignments, grades);
    expect(Number.isFinite(percent)).toBe(true);
    expect(percent).toBeGreaterThan(80);
  });

  it('zero-weight active group redistributes to other group', () => {
    const course = {
      groups: [
        { name: 'Zero', weight: 0 },
        { name: 'Active', weight: 100 },
      ],
    };
    const assignments = [
      buildAssignment({ id: 'z1', group: 'Zero', dueDate: FUTURE_DUE }),
      buildAssignment({ id: 'a1', group: 'Active' }),
    ];
    const grades = buildGrades(sid, { a1: 75 });
    expect(run(course, assignments, grades)).toBeCloseTo(75, 5);
  });

  it('deprecated getWeightedGradeForStudent still returns finite number', () => {
    const course = { groups: [{ name: 'Assignments', weight: 100 }] };
    const assignments = [buildAssignment({ id: 'a1', group: 'Assignments' })];
    const grades = buildGrades(sid, { a1: 88 });
    const legacy = getWeightedGradeForStudent(sid, course, assignments, grades, {});
    expect(Number.isFinite(legacy)).toBe(true);
  });
});
