/**
 * Thin integration: controller-grade pipeline (buildGradesMap + calculate) without MongoDB.
 * Mirrors grades.controller / reports.controller data shaping.
 */
const {
  calculateFinalGradeWithWeightedGroups,
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  getLetterGrade,
  buildGradesMapForStudent,
  resolveAssignmentGrade,
} = require('../../shared/grading/index.cjs');
const { computeDualGradeTotals, toStudentGradeApiResponse } = require('../../services/gradeCalculation.service');
const { case1StandardWeighted, case5Excused } = require('./fixtures');
const { cp25SubmittedUngradedFinalGap } = require('./canvasParity.fixtures');

describe('Grades API pipeline (fixture integration)', () => {
  it('buildGradesMap + calculate matches Case 1 transcript/gradebook contract', () => {
    const scenario = case1StandardWeighted();
    const { studentId, course, assignments, grades: prebuilt, submissions } = scenario;

    const pipelineGrades = {};
    const rows = assignments.map((a) => ({
      _id: a._id,
      group: a.group,
      totalPoints: a.totalPoints,
      questions: a.questions,
      published: a.published,
      dueDate: a.dueDate,
      isDiscussion: a.isDiscussion,
      hasSubmitted: a.hasSubmitted,
      grade: prebuilt[studentId][a._id],
    }));
    buildGradesMapForStudent(pipelineGrades, studentId, rows);

    const percent = calculateFinalGradeWithWeightedGroups(
      studentId,
      course,
      assignments,
      pipelineGrades,
      submissions
    );
    const letter = getLetterGrade(percent, course.gradeScale);

    expect(percent).toBeCloseTo(83, 5);
    expect(letter).toBe('B');
  });

  it('resolveAssignmentGrade maps submission.excused to excused sentinel', () => {
    expect(
      resolveAssignmentGrade({
        submission: { excused: true, grade: 0 },
      })
    ).toBe('excused');
  });

  it('excused pipeline yields 80% overall (Case 5)', () => {
    const scenario = case5Excused();
    const grades = {};
    const rows = scenario.assignments.map((a) => ({
      _id: a._id,
      group: a.group,
      totalPoints: a.totalPoints,
      questions: a.questions,
      published: a.published,
      dueDate: a.dueDate,
      grade: scenario.grades[scenario.studentId][a._id],
    }));
    buildGradesMapForStudent(grades, scenario.studentId, rows);
    const percent = calculateFinalGradeWithWeightedGroups(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      grades,
      scenario.submissions
    );
    expect(percent).toBeCloseTo(80, 5);
  });

  it('dual totals pipeline matches CP-25 under count_as_zero', () => {
    const scenario = cp25SubmittedUngradedFinalGap();
    const dual = computeDualGradeTotals(
      scenario.studentId,
      scenario.course,
      scenario.assignments,
      scenario.grades,
      scenario.submissions,
      null
    );
    expect(dual.currentPercent).toBeCloseTo(80, 5);
    expect(dual.finalPercent).toBeCloseTo(40, 5);
    expect(dual.totalPercent).toBe(dual.currentPercent);

    const api = toStudentGradeApiResponse({
      ...dual,
      fromFrozenSnapshot: false,
    });
    expect(api.currentPercent).toBeCloseTo(80, 5);
    expect(api.finalPercent).toBeCloseTo(40, 5);
    expect(api.totalPercent).toBe(api.currentPercent);
    expect(api.letterGrade).toBeTruthy();
    expect(api.finalLetterGrade).toBeTruthy();
  });

  it('current and final calculators diverge for CP-25 under count_as_zero', () => {
    const scenario = cp25SubmittedUngradedFinalGap();
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
    expect(current).toBeCloseTo(80, 5);
    expect(finalGrade).toBeCloseTo(40, 5);
  });
});
