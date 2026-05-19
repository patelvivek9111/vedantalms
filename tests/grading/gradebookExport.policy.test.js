/**
 * Export label contract — uses shared/grading/gradebookCell.cjs (same as frontend export).
 */
const { getGradebookCellForExport } = require('../../shared/grading/gradebookCell.cjs');
const {
  POLICY_NOW,
  PAST_DUE,
  LATE_SUBMIT_AT,
  STUDENT_ID,
  buildAssignment,
  buildGrades,
  EXCUSED_GRADE,
  case5Excused,
} = require('./fixtures');

describe('Gradebook export cell labels (shared module)', () => {
  const student = { _id: STUDENT_ID };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(POLICY_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('missing past due → 0 (MA)', () => {
    const assignment = buildAssignment({
      id: 'a-miss',
      group: 'Assignments',
      dueDate: PAST_DUE,
    });
    const cell = getGradebookCellForExport(student, assignment, buildGrades(STUDENT_ID, {}), {});
    expect(cell.display).toBe('0 (MA)');
    expect(cell.marker).toBe('RED');
  });

  it('submitted not graded → Not Graded', () => {
    const assignment = buildAssignment({ id: 'a-pend', group: 'Assignments' });
    const cell = getGradebookCellForExport(
      student,
      assignment,
      buildGrades(STUDENT_ID, {}),
      { [`${STUDENT_ID}_a-pend`]: 'sub-1' }
    );
    expect(cell.display).toBe('Not Graded');
    expect(cell.marker).toBe('BLUE');
  });

  it('late ungraded → Late', () => {
    const assignment = buildAssignment({
      id: 'a-late',
      group: 'Assignments',
      dueDate: PAST_DUE,
    });
    const cell = getGradebookCellForExport(
      student,
      assignment,
      buildGrades(STUDENT_ID, {}),
      { [`${STUDENT_ID}_a-late`]: 'sub-late' },
      [{ _id: 'sub-late', submittedAt: LATE_SUBMIT_AT }]
    );
    expect(cell.display).toBe('Late');
    expect(cell.marker).toBe('ORANGE');
  });

  it('excused → Excused', () => {
    const scenario = case5Excused();
    const excused = scenario.assignments.find((a) => a._id === scenario.excusedCell.assignmentId);
    const submissionMap = {};
    submissionMap[`${STUDENT_ID}_${excused._id}`] = 'sub-excused';
    const cell = getGradebookCellForExport(
      student,
      excused,
      scenario.grades,
      submissionMap,
      [{ _id: 'sub-excused', excused: true }]
    );
    expect(cell.display).toBe('Excused');
    expect(cell.marker).toBe('GRAY');
  });

  it('excused grade sentinel in grades map → Excused', () => {
    const assignment = buildAssignment({ id: 'a-exc', group: 'Assignments' });
    const grades = buildGrades(STUDENT_ID, { 'a-exc': EXCUSED_GRADE });
    const cell = getGradebookCellForExport(student, assignment, grades, {}, []);
    expect(cell.display).toBe('Excused');
  });
});
