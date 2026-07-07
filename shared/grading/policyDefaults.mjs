/**
 * Default grading policy — matches pre-policy grading contract (backward compatible).
 */
export const DEFAULT_GRADING_POLICY = {
  version: 1,
  missingAssignment: { mode: 'count_as_zero' },
  latePenalty: {
    enabled: false,
    mode: 'per_day',
    fixedPercent: 10,
    perDayPercent: 5,
    gracePeriodHours: 0,
    capPercent: 100,
  },
  dropLowest: { enabled: false, rules: [] },
  dropHighest: { enabled: false, rules: [] },
  gradeVisibility: {
    mutedAssignmentsInTotals: 'exclude', // 'exclude' | 'include'
  },
  categoryCaps: { enabled: false, caps: [] },
  attendance: {
    mode: 'weighted_group',
    groupName: 'Attendance',
    weightPercent: null,
  },
  gpaScale: {
    type: 'letter',
    mappings: [
      { letter: 'A', points: 4.0 },
      { letter: 'A-', points: 3.7 },
      { letter: 'B+', points: 3.3 },
      { letter: 'B', points: 3.0 },
      { letter: 'B-', points: 2.7 },
      { letter: 'C+', points: 2.3 },
      { letter: 'C', points: 2.0 },
      { letter: 'D', points: 1.0 },
      { letter: 'F', points: 0.0 },
    ],
  },
  extraCredit: {
    enabled: true,
    capPercent: null,
  },
};

export const DEFAULT_GRADE_SCALE = [
  { letter: 'A', min: 90, max: 100 },
  { letter: 'B', min: 80, max: 89 },
  { letter: 'C', min: 70, max: 79 },
  { letter: 'D', min: 60, max: 69 },
  { letter: 'F', min: 0, max: 59 },
];
