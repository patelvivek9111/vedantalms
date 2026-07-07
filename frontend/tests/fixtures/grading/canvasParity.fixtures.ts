/**
 * Canvas parity fixtures (frontend Vitest mirror).
 * Keep aligned with tests/grading/canvasParity.fixtures.js
 */

import {
  STUDENT_ID,
  aid,
  buildCourse,
  buildAssignment,
  buildGrades,
} from './fixtures';

/** Fixed policy clock — aligned with tests/grading/canvasParity.fixtures.js (backend). */
export const POLICY_NOW = new Date('2025-06-15T12:00:00.000Z');
const PAST_DUE = '2025-06-01T00:00:00.000Z';
const FUTURE_DUE = '2025-12-01T00:00:00.000Z';
const LATE_SUBMIT_AT = '2025-06-10T08:00:00.000Z';

export type CanvasParityScenario = {
  id: string;
  title: string;
  canvasReference: string;
  implementationStatus: 'baseline' | 'pending_phase_3' | 'pending_phase_5';
  studentId: string;
  gradeMode: 'current';
  course: ReturnType<typeof buildCourse>;
  assignments: ReturnType<typeof buildAssignment>[];
  grades: ReturnType<typeof buildGrades>;
  submissions: Record<string, unknown>;
  policyOverride?: Record<string, unknown>;
  expectedCurrentPercent?: number;
  canvasFinalPercent?: number;
  canvasExtraCreditPercent?: number;
  assertLessThan?: number;
  assertLessThanUncapped?: boolean;
  gapId: string;
  decision: 'keep' | 'change' | 'current_keep_final_add';
};

function cpScenario(base: Omit<CanvasParityScenario, 'studentId' | 'gradeMode'>): CanvasParityScenario {
  return { studentId: STUDENT_ID, gradeMode: 'current', ...base };
}

function buildSubmissions(entries: Record<string, unknown | boolean>) {
  const map: Record<string, unknown> = {};
  for (const [assignmentId, sub] of Object.entries(entries)) {
    map[String(assignmentId)] = sub === true ? { _id: `sub-${assignmentId}` } : sub;
  }
  return map;
}

export function cp11PartiallyGradedCourse(): CanvasParityScenario {
  const groups = [
    { name: 'Homework', weight: 50 },
    { name: 'Exams', weight: 50 },
  ];
  const hwId = aid('cp11-hw');
  const examId = aid('cp11-exam');
  const assignments = [
    buildAssignment({ id: hwId, group: 'Homework' }),
    buildAssignment({ id: examId, group: 'Exams', dueDate: FUTURE_DUE }),
  ];
  return cpScenario({
    id: 'cp11',
    title: 'Partially graded course — one active group',
    canvasReference: 'Canvas Current Grade: inactive groups excluded; weights redistributed',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments,
    grades: buildGrades(STUDENT_ID, { [hwId]: 80 }),
    submissions: buildSubmissions({ [hwId]: true }),
    expectedCurrentPercent: 80,
    canvasFinalPercent: 40,
    gapId: 'G-01',
    decision: 'current_keep_final_add',
  });
}

export function cp12GradedZeroActivatesGroup(): CanvasParityScenario {
  const zeroId = aid('cp12-zero');
  return cpScenario({
    id: 'cp12',
    title: 'Graded zero activates group',
    canvasReference: 'Canvas: scored 0/100 is graded work, not missing',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [buildAssignment({ id: zeroId, group: 'Assignments' })],
    grades: buildGrades(STUDENT_ID, { [zeroId]: 0 }),
    submissions: buildSubmissions({ [zeroId]: true }),
    expectedCurrentPercent: 0,
    canvasFinalPercent: 0,
    gapId: 'G-08',
    decision: 'keep',
  });
}

export function cp13EmptyAssignmentGroupFutureOnly(): CanvasParityScenario {
  const doneId = aid('cp13-done');
  const futureId = aid('cp13-future');
  const groups = [
    { name: 'Completed', weight: 50 },
    { name: 'Upcoming', weight: 50 },
  ];
  return cpScenario({
    id: 'cp13',
    title: 'Empty assignment group — all future due',
    canvasReference: 'Canvas Current Grade: future work does not penalize student',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments: [
      buildAssignment({ id: doneId, group: 'Completed' }),
      buildAssignment({ id: futureId, group: 'Upcoming', dueDate: FUTURE_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [doneId]: 90 }),
    submissions: buildSubmissions({ [doneId]: true }),
    expectedCurrentPercent: 90,
    canvasFinalPercent: 45,
    gapId: 'G-04',
    decision: 'keep',
  });
}

export function cp14FutureAssignmentSameGroup(): CanvasParityScenario {
  const gradedId = aid('cp14-graded');
  const futureId = aid('cp14-future');
  return cpScenario({
    id: 'cp14',
    title: 'Future assignment in same group as graded work',
    canvasReference: 'Canvas Current Grade: ungraded future items excluded from denominator',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: gradedId, group: 'Assignments' }),
      buildAssignment({ id: futureId, group: 'Assignments', dueDate: FUTURE_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [gradedId]: 90 }),
    submissions: buildSubmissions({ [gradedId]: true }),
    expectedCurrentPercent: 90,
    canvasFinalPercent: 90,
    gapId: 'G-04',
    decision: 'keep',
  });
}

export function cp15ExcludeUntilGraded(): CanvasParityScenario {
  const gradedId = aid('cp15-graded');
  const missingId = aid('cp15-missing');
  return cpScenario({
    id: 'cp15',
    title: 'exclude_until_graded missing assignment',
    canvasReference: 'Canvas: treat ungraded as not yet due (exclude mode)',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: missingId, group: 'Assignments', dueDate: PAST_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [gradedId]: 80 }),
    submissions: buildSubmissions({ [gradedId]: true }),
    policyOverride: { missingAssignment: { mode: 'exclude_until_graded' } },
    expectedCurrentPercent: 80,
    canvasFinalPercent: 80,
    gapId: 'G-07',
    decision: 'keep',
  });
}

export function cp16ExcusedOnlyGroupInactive(): CanvasParityScenario {
  const gradedId = aid('cp16-graded');
  const excusedId = aid('cp16-excused');
  const groups = [
    { name: 'Graded', weight: 50 },
    { name: 'ExcusedOnly', weight: 50 },
  ];
  return cpScenario({
    id: 'cp16',
    title: 'Excused-only group inactive',
    canvasReference: 'Canvas: excused items excluded; empty group weight redistributed',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments: [
      buildAssignment({ id: gradedId, group: 'Graded' }),
      buildAssignment({ id: excusedId, group: 'ExcusedOnly' }),
    ],
    grades: buildGrades(STUDENT_ID, { [gradedId]: 85, [excusedId]: 'excused' }),
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

export function cp17GradedZeroAndMissing(): CanvasParityScenario {
  const a50 = aid('cp17-fifty');
  const a0 = aid('cp17-zero');
  const missing = aid('cp17-missing');
  return cpScenario({
    id: 'cp17',
    title: 'Graded zero plus missing assignment in group',
    canvasReference: 'Canvas: zero is graded; missing counts as zero (default policy)',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: a50, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: a0, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: missing, group: 'Assignments', dueDate: PAST_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [a50]: 50, [a0]: 0 }),
    submissions: buildSubmissions({ [a50]: true, [a0]: true }),
    expectedCurrentPercent: 50 / 3,
    canvasFinalPercent: 50 / 3,
    gapId: 'G-06',
    decision: 'keep',
  });
}

export function cp18DropLowestGradedZero(): CanvasParityScenario {
  const highId = aid('cp18-high');
  const zeroId = aid('cp18-zero');
  return cpScenario({
    id: 'cp18',
    title: 'Drop lowest removes graded zero',
    canvasReference: 'Canvas: drop lowest scored items (0% is droppable when graded)',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: highId, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: zeroId, group: 'Assignments', dueDate: PAST_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [highId]: 80, [zeroId]: 0 }),
    submissions: buildSubmissions({ [highId]: true, [zeroId]: true }),
    policyOverride: {
      dropLowest: { enabled: true, rules: [{ groupName: 'Assignments', count: 1 }] },
    },
    expectedCurrentPercent: 80,
    canvasFinalPercent: 80,
    gapId: 'G-11',
    decision: 'keep',
  });
}

export function cp19LatePenaltyPerDay(): CanvasParityScenario {
  const onTimeId = aid('cp19-on-time');
  const lateId = aid('cp19-late');
  return cpScenario({
    id: 'cp19',
    title: 'Late penalty per day',
    canvasReference: 'Canvas: late policy reduces score on late submissions',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: onTimeId, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: lateId, group: 'Assignments', dueDate: PAST_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [onTimeId]: 80, [lateId]: 60 }),
    submissions: buildSubmissions({
      [onTimeId]: { submittedAt: PAST_DUE },
      [lateId]: { submittedAt: LATE_SUBMIT_AT },
    }),
    policyOverride: {
      latePenalty: {
        enabled: true,
        mode: 'per_day',
        perDayPercent: 10,
        gracePeriodHours: 0,
        capPercent: 50,
      },
    },
    assertLessThan: 70,
    gapId: 'G-12',
    decision: 'keep',
  });
}

export function cp20CategoryCap(): CanvasParityScenario {
  const heavyId = aid('cp20-heavy');
  const lightId = aid('cp20-light');
  const groups = [
    { name: 'Heavy', weight: 80 },
    { name: 'Light', weight: 20 },
  ];
  return cpScenario({
    id: 'cp20',
    title: 'Category cap limits group weight',
    canvasReference: 'Canvas: assignment group weight caps',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments: [
      buildAssignment({ id: heavyId, group: 'Heavy', dueDate: PAST_DUE }),
      buildAssignment({ id: lightId, group: 'Light', dueDate: PAST_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [heavyId]: 100, [lightId]: 0 }),
    submissions: buildSubmissions({ [heavyId]: true, [lightId]: true }),
    policyOverride: {
      categoryCaps: { enabled: true, caps: [{ groupName: 'Heavy', maxWeightPercent: 50 }] },
    },
    assertLessThanUncapped: true,
    gapId: 'G-13',
    decision: 'keep',
  });
}

export function cp21UngroupedAssignments(): CanvasParityScenario {
  const groupedId = aid('cp21-grouped');
  const ungroupedId = aid('cp21-ungrouped');
  return cpScenario({
    id: 'cp21',
    title: 'Ungrouped assignments use remaining weight',
    canvasReference: 'Canvas: assignments outside groups use remaining weight',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Graded', weight: 50 }]),
    assignments: [
      buildAssignment({ id: groupedId, group: 'Graded' }),
      buildAssignment({ id: ungroupedId, group: 'Ungrouped' }),
    ],
    grades: buildGrades(STUDENT_ID, { [groupedId]: 80, [ungroupedId]: 100 }),
    submissions: buildSubmissions({ [groupedId]: true, [ungroupedId]: true }),
    expectedCurrentPercent: 90,
    canvasFinalPercent: 90,
    gapId: 'G-14',
    decision: 'keep',
  });
}

export function cp22TwoGroupsPartialGrading(): CanvasParityScenario {
  const hw1 = aid('cp22-hw1');
  const hw2 = aid('cp22-hw2');
  const exam = aid('cp22-exam');
  const groups = [
    { name: 'Homework', weight: 60 },
    { name: 'Exams', weight: 40 },
  ];
  return cpScenario({
    id: 'cp22',
    title: 'Two groups — one partially graded, one future-only',
    canvasReference: 'Canvas Current Grade: HW (50+100)/200 = 75%, exam group inactive',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments: [
      buildAssignment({ id: hw1, group: 'Homework', dueDate: PAST_DUE }),
      buildAssignment({ id: hw2, group: 'Homework', dueDate: PAST_DUE }),
      buildAssignment({ id: exam, group: 'Exams', dueDate: FUTURE_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [hw1]: 50, [hw2]: 100 }),
    submissions: buildSubmissions({ [hw1]: true, [hw2]: true }),
    expectedCurrentPercent: 75,
    canvasFinalPercent: 45,
    gapId: 'G-01',
    decision: 'current_keep_final_add',
  });
}

export function cp23CanvasFinalGradeGap(): CanvasParityScenario {
  const hwId = aid('cp23-hw');
  const examId = aid('cp23-exam');
  const groups = [
    { name: 'Homework', weight: 50 },
    { name: 'Exams', weight: 50 },
  ];
  return cpScenario({
    id: 'cp23',
    title: 'Canvas Final Grade gap — future exam at full weight',
    canvasReference: 'Canvas Final Grade: all published assignments; unsubmitted = 0',
    implementationStatus: 'baseline',
    course: buildCourse(groups),
    assignments: [
      buildAssignment({ id: hwId, group: 'Homework' }),
      buildAssignment({ id: examId, group: 'Exams', dueDate: FUTURE_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [hwId]: 100 }),
    submissions: buildSubmissions({ [hwId]: true }),
    expectedCurrentPercent: 100,
    canvasFinalPercent: 50,
    gapId: 'G-01',
    decision: 'change',
  });
}

export function cp24ExtraCreditBaseline(): CanvasParityScenario {
  const regularId = aid('cp24-regular');
  const ecId = aid('cp24-ec');
  return cpScenario({
    id: 'cp24',
    title: 'Extra credit assignment exceeds 100%',
    canvasReference: 'Canvas: extra credit adds points without increasing possible',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: regularId, group: 'Assignments' }),
      buildAssignment({ id: ecId, group: 'Assignments', totalPoints: 10, isExtraCredit: true }),
    ],
    grades: buildGrades(STUDENT_ID, { [regularId]: 100, [ecId]: 10 }),
    submissions: buildSubmissions({ [regularId]: true, [ecId]: true }),
    expectedCurrentPercent: 110,
    canvasExtraCreditPercent: 110,
    gapId: 'G-15',
    decision: 'change',
  });
}

export function cp25SubmittedUngradedFinalGap(): CanvasParityScenario {
  const gradedId = aid('cp25-graded');
  const pendingId = aid('cp25-pending');
  return cpScenario({
    id: 'cp25',
    title: 'Submitted ungraded — current vs final gap',
    canvasReference: 'Canvas Current: excluded; Canvas Final: counts as 0 when treat-ungraded-as-zero',
    implementationStatus: 'baseline',
    course: buildCourse([{ name: 'Assignments', weight: 100 }]),
    assignments: [
      buildAssignment({ id: gradedId, group: 'Assignments', dueDate: PAST_DUE }),
      buildAssignment({ id: pendingId, group: 'Assignments', dueDate: PAST_DUE }),
    ],
    grades: buildGrades(STUDENT_ID, { [gradedId]: 80 }),
    submissions: buildSubmissions({ [gradedId]: true, [pendingId]: true }),
    expectedCurrentPercent: 80,
    canvasFinalPercent: 40,
    gapId: 'G-05',
    decision: 'keep',
  });
}

export const BASELINE_SCENARIOS = [
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

export const PENDING_SCENARIOS: (() => CanvasParityScenario)[] = [];

export const ALL_CANVAS_PARITY_SCENARIOS = [...BASELINE_SCENARIOS, ...PENDING_SCENARIOS];
