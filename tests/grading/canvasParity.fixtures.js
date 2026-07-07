/**
 * Canvas parity fixtures (Phase 1 audit).
 * Extends tests/grading/fixtures.js with CP-11 … CP-25 scenarios.
 *
 * Each scenario includes:
 *   - expectedCurrentPercent  → today's calculateFinalGradeWithWeightedGroups
 *   - canvasFinalPercent      → target for Phase 3 (projected final grade)
 *   - implementationStatus    → 'baseline' | 'pending_phase_3' | 'pending_phase_5'
 *
 * Keep aligned with frontend/tests/fixtures/grading/canvasParity.fixtures.ts
 */

const { EXCUSED_GRADE } = require('../../shared/grading/constants.cjs');
const {
  STUDENT_ID,
  POLICY_NOW,
  PAST_DUE,
  FUTURE_DUE,
  LATE_SUBMIT_AT,
  aid,
  buildCourse,
  buildAssignment,
  buildGrades,
  buildSubmissions,
} = require('./fixtures');

function cpScenario(base) {
  return {
    studentId: STUDENT_ID,
    gradeMode: 'current',
    ...base,
  };
}

/** CP-11: One group graded, other group entirely future-due → weight redistributed */
function cp11PartiallyGradedCourse() {
  const groups = [
    { name: 'Homework', weight: 50 },
    { name: 'Exams', weight: 50 },
  ];
  const hwId = aid('cp11-hw');
  const examId = aid('cp11-exam');
  const assignments = [
    buildAssignment({ id: hwId, group: 'Homework', totalPoints: 100 }),
    buildAssignment({ id: examId, group: 'Exams', totalPoints: 100, dueDate: FUTURE_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [hwId]: 80 });
  return cpScenario({
    id: 'cp11',
    title: 'Partially graded course — one active group',
    canvasReference: 'Canvas Current Grade: inactive groups excluded; weights redistributed',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [hwId]: true }),
    expectedCurrentPercent: 80,
    canvasFinalPercent: 40,
    gapId: 'G-01',
    decision: 'current_keep_final_add',
  });
}

/** CP-12: Graded zero is a valid grade and activates the group */
function cp12GradedZeroActivatesGroup() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const zeroId = aid('cp12-zero');
  const assignments = [buildAssignment({ id: zeroId, group: 'Assignments' })];
  const grades = buildGrades(STUDENT_ID, { [zeroId]: 0 });
  return cpScenario({
    id: 'cp12',
    title: 'Graded zero activates group',
    canvasReference: 'Canvas: scored 0/100 is graded work, not missing',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [zeroId]: true }),
    expectedCurrentPercent: 0,
    canvasFinalPercent: 0,
    gapId: 'G-08',
    decision: 'keep',
  });
}

/** CP-13: Group with only future-due assignments stays inactive */
function cp13EmptyAssignmentGroupFutureOnly() {
  const groups = [
    { name: 'Completed', weight: 50 },
    { name: 'Upcoming', weight: 50 },
  ];
  const doneId = aid('cp13-done');
  const futureId = aid('cp13-future');
  const assignments = [
    buildAssignment({ id: doneId, group: 'Completed', totalPoints: 100 }),
    buildAssignment({ id: futureId, group: 'Upcoming', totalPoints: 100, dueDate: FUTURE_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [doneId]: 90 });
  return cpScenario({
    id: 'cp13',
    title: 'Empty assignment group — all future due',
    canvasReference: 'Canvas Current Grade: future work does not penalize student',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [doneId]: true }),
    expectedCurrentPercent: 90,
    canvasFinalPercent: 45,
    gapId: 'G-04',
    decision: 'keep',
  });
}

/** CP-14: Graded + future ungraded in same group — only graded counts (current) */
function cp14FutureAssignmentSameGroup() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('cp14-graded');
  const futureId = aid('cp14-future');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments' }),
    buildAssignment({ id: futureId, group: 'Assignments', dueDate: FUTURE_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [gradedId]: 90 });
  return cpScenario({
    id: 'cp14',
    title: 'Future assignment in same group as graded work',
    canvasReference: 'Canvas Current Grade: ungraded future items excluded from denominator',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [gradedId]: true }),
    expectedCurrentPercent: 90,
    canvasFinalPercent: 90,
    gapId: 'G-04',
    decision: 'keep',
  });
}

/** CP-15: exclude_until_graded — missing past due excluded from denominator */
function cp15ExcludeUntilGraded() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('cp15-graded');
  const missingId = aid('cp15-missing');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: missingId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
  const policyOverride = { missingAssignment: { mode: 'exclude_until_graded' } };
  return cpScenario({
    id: 'cp15',
    title: 'exclude_until_graded missing assignment',
    canvasReference: 'Canvas: treat ungraded as not yet due (exclude mode)',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [gradedId]: true }),
    policyOverride,
    expectedCurrentPercent: 80,
    canvasFinalPercent: 80,
    gapId: 'G-07',
    decision: 'keep',
  });
}

/** CP-16: Group with only excused work is inactive — weight redistributed */
function cp16ExcusedOnlyGroupInactive() {
  const groups = [
    { name: 'Graded', weight: 50 },
    { name: 'ExcusedOnly', weight: 50 },
  ];
  const gradedId = aid('cp16-graded');
  const excusedId = aid('cp16-excused');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Graded' }),
    buildAssignment({ id: excusedId, group: 'ExcusedOnly' }),
  ];
  const grades = buildGrades(STUDENT_ID, {
    [gradedId]: 85,
    [excusedId]: EXCUSED_GRADE,
  });
  return cpScenario({
    id: 'cp16',
    title: 'Excused-only group inactive',
    canvasReference: 'Canvas: excused items excluded; empty group weight redistributed',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({
      [gradedId]: true,
      [excusedId]: { _id: 'sub-cp16-exc', excused: true },
    }),
    expectedCurrentPercent: 85,
    canvasFinalPercent: 42.5,
    gapId: 'G-09',
    decision: 'keep',
  });
}

/** CP-17: Graded zero + missing in same group */
function cp17GradedZeroAndMissing() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const a50 = aid('cp17-fifty');
  const a0 = aid('cp17-zero');
  const missing = aid('cp17-missing');
  const assignments = [
    buildAssignment({ id: a50, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: a0, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: missing, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [a50]: 50, [a0]: 0 });
  return cpScenario({
    id: 'cp17',
    title: 'Graded zero plus missing assignment in group',
    canvasReference: 'Canvas: zero is graded; missing counts as zero (default policy)',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [a50]: true, [a0]: true }),
    expectedCurrentPercent: 50 / 3,
    canvasFinalPercent: 50 / 3,
    gapId: 'G-06',
    decision: 'keep',
  });
}

/** CP-18: Drop lowest removes graded zero, keeping higher score */
function cp18DropLowestGradedZero() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const highId = aid('cp18-high');
  const zeroId = aid('cp18-zero');
  const assignments = [
    buildAssignment({ id: highId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: zeroId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [highId]: 80, [zeroId]: 0 });
  const policyOverride = {
    dropLowest: { enabled: true, rules: [{ groupName: 'Assignments', count: 1 }] },
  };
  return cpScenario({
    id: 'cp18',
    title: 'Drop lowest removes graded zero',
    canvasReference: 'Canvas: drop lowest scored items (0% is droppable when graded)',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [highId]: true, [zeroId]: true }),
    policyOverride,
    expectedCurrentPercent: 80,
    canvasFinalPercent: 80,
    gapId: 'G-11',
    decision: 'keep',
  });
}

/** CP-19: Late penalty per day reduces earned points */
function cp19LatePenaltyPerDay() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const onTimeId = aid('cp19-on-time');
  const lateId = aid('cp19-late');
  const assignments = [
    buildAssignment({ id: onTimeId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: lateId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [onTimeId]: 80, [lateId]: 60 });
  const submissions = buildSubmissions({
    [onTimeId]: { submittedAt: PAST_DUE },
    [lateId]: { submittedAt: LATE_SUBMIT_AT },
  });
  const policyOverride = {
    latePenalty: {
      enabled: true,
      mode: 'per_day',
      perDayPercent: 10,
      gracePeriodHours: 0,
      capPercent: 50,
    },
  };
  return cpScenario({
    id: 'cp19',
    title: 'Late penalty per day',
    canvasReference: 'Canvas: late policy reduces score on late submissions',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions,
    policyOverride,
    assertLessThan: 70,
    gapId: 'G-12',
    decision: 'keep',
  });
}

/** CP-20: Category cap limits group weight contribution */
function cp20CategoryCap() {
  const groups = [
    { name: 'Heavy', weight: 80 },
    { name: 'Light', weight: 20 },
  ];
  const heavyId = aid('cp20-heavy');
  const lightId = aid('cp20-light');
  const assignments = [
    buildAssignment({ id: heavyId, group: 'Heavy', dueDate: PAST_DUE }),
    buildAssignment({ id: lightId, group: 'Light', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [heavyId]: 100, [lightId]: 0 });
  const policyOverride = {
    categoryCaps: { enabled: true, caps: [{ groupName: 'Heavy', maxWeightPercent: 50 }] },
  };
  return cpScenario({
    id: 'cp20',
    title: 'Category cap limits group weight',
    canvasReference: 'Canvas: assignment group weight caps',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [heavyId]: true, [lightId]: true }),
    policyOverride,
    assertLessThanUncapped: true,
    gapId: 'G-13',
    decision: 'keep',
  });
}

/** CP-21: Ungrouped assignments consume remaining weight bucket */
function cp21UngroupedAssignments() {
  const groups = [{ name: 'Graded', weight: 50 }];
  const groupedId = aid('cp21-grouped');
  const ungroupedId = aid('cp21-ungrouped');
  const assignments = [
    buildAssignment({ id: groupedId, group: 'Graded' }),
    buildAssignment({ id: ungroupedId, group: 'Ungrouped' }),
  ];
  const grades = buildGrades(STUDENT_ID, { [groupedId]: 80, [ungroupedId]: 100 });
  return cpScenario({
    id: 'cp21',
    title: 'Ungrouped assignments use remaining weight',
    canvasReference: 'Canvas: assignments outside groups use remaining weight',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [groupedId]: true, [ungroupedId]: true }),
    expectedCurrentPercent: 90,
    canvasFinalPercent: 90,
    gapId: 'G-14',
    decision: 'keep',
  });
}

/** CP-22: Two groups with partial grading — active group normalized */
function cp22TwoGroupsPartialGrading() {
  const groups = [
    { name: 'Homework', weight: 60 },
    { name: 'Exams', weight: 40 },
  ];
  const hw1 = aid('cp22-hw1');
  const hw2 = aid('cp22-hw2');
  const exam = aid('cp22-exam');
  const assignments = [
    buildAssignment({ id: hw1, group: 'Homework', dueDate: PAST_DUE }),
    buildAssignment({ id: hw2, group: 'Homework', dueDate: PAST_DUE }),
    buildAssignment({ id: exam, group: 'Exams', dueDate: FUTURE_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [hw1]: 50, [hw2]: 100 });
  return cpScenario({
    id: 'cp22',
    title: 'Two groups — one partially graded, one future-only',
    canvasReference: 'Canvas Current Grade: HW (50+100)/200 = 75%, exam group inactive',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [hw1]: true, [hw2]: true }),
    expectedCurrentPercent: 75,
    canvasFinalPercent: 45,
    gapId: 'G-01',
    decision: 'current_keep_final_add',
  });
}

/** CP-23: Canonical Canvas Final Grade gap — perfect HW, future exam */
function cp23CanvasFinalGradeGap() {
  const groups = [
    { name: 'Homework', weight: 50 },
    { name: 'Exams', weight: 50 },
  ];
  const hwId = aid('cp23-hw');
  const examId = aid('cp23-exam');
  const assignments = [
    buildAssignment({ id: hwId, group: 'Homework' }),
    buildAssignment({ id: examId, group: 'Exams', dueDate: FUTURE_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [hwId]: 100 });
  return cpScenario({
    id: 'cp23',
    title: 'Canvas Final Grade gap — future exam at full weight',
    canvasReference: 'Canvas Final Grade: all published assignments; unsubmitted = 0',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [hwId]: true }),
    expectedCurrentPercent: 100,
    canvasFinalPercent: 50,
    gapId: 'G-01',
    decision: 'change',
  });
}

/** CP-24: Extra credit — 100% base + EC bonus can exceed 100% */
function cp24ExtraCreditBaseline() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const regularId = aid('cp24-regular');
  const ecId = aid('cp24-ec');
  const assignments = [
    buildAssignment({ id: regularId, group: 'Assignments' }),
    buildAssignment({ id: ecId, group: 'Assignments', totalPoints: 10, isExtraCredit: true }),
  ];
  const grades = buildGrades(STUDENT_ID, { [regularId]: 100, [ecId]: 10 });
  return cpScenario({
    id: 'cp24',
    title: 'Extra credit assignment exceeds 100%',
    canvasReference: 'Canvas: extra credit adds points without increasing possible',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [regularId]: true, [ecId]: true }),
    expectedCurrentPercent: 110,
    canvasExtraCreditPercent: 110,
    gapId: 'G-15',
    decision: 'change',
  });
}

/** CP-25: Submitted ungraded — current excludes, Canvas final includes as 0 */
function cp25SubmittedUngradedFinalGap() {
  const groups = [{ name: 'Assignments', weight: 100 }];
  const gradedId = aid('cp25-graded');
  const pendingId = aid('cp25-pending');
  const assignments = [
    buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
    buildAssignment({ id: pendingId, group: 'Assignments', dueDate: PAST_DUE }),
  ];
  const grades = buildGrades(STUDENT_ID, { [gradedId]: 80 });
  return cpScenario({
    id: 'cp25',
    title: 'Submitted ungraded — current vs final gap',
    canvasReference: 'Canvas Current (exclude mode): excluded; count_as_zero: 80/200; Final: counts as 0',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades,
    submissions: buildSubmissions({ [gradedId]: true, [pendingId]: true }),
    expectedCurrentPercent: 80,
    canvasFinalPercent: 40,
    gapId: 'G-05',
    decision: 'keep',
  });
}

const BASELINE_SCENARIOS = [
  cp11PartiallyGradedCourse,
  cp12GradedZeroActivatesGroup,
  cp13EmptyAssignmentGroupFutureOnly,
  cp14FutureAssignmentSameGroup,
  cp15ExcludeUntilGraded,
  cp16ExcusedOnlyGroupInactive,
  cp17GradedZeroAndMissing,
  cp18DropLowestGradedZero,
  cp19LatePenaltyPerDay,
  cp20CategoryCap,
  cp21UngroupedAssignments,
  cp22TwoGroupsPartialGrading,
  cp23CanvasFinalGradeGap,
  cp24ExtraCreditBaseline,
  cp25SubmittedUngradedFinalGap,
];

const PENDING_SCENARIOS = [];

const ALL_CANVAS_PARITY_SCENARIOS = [...BASELINE_SCENARIOS, ...PENDING_SCENARIOS];

module.exports = {
  POLICY_NOW,
  BASELINE_SCENARIOS,
  PENDING_SCENARIOS,
  ALL_CANVAS_PARITY_SCENARIOS,
  cp11PartiallyGradedCourse,
  cp12GradedZeroActivatesGroup,
  cp13EmptyAssignmentGroupFutureOnly,
  cp14FutureAssignmentSameGroup,
  cp15ExcludeUntilGraded,
  cp16ExcusedOnlyGroupInactive,
  cp17GradedZeroAndMissing,
  cp18DropLowestGradedZero,
  cp19LatePenaltyPerDay,
  cp20CategoryCap,
  cp21UngroupedAssignments,
  cp22TwoGroupsPartialGrading,
  cp23CanvasFinalGradeGap,
  cp24ExtraCreditBaseline,
  cp25SubmittedUngradedFinalGap,
};
