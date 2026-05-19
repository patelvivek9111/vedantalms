/**
 * Default grading policy — matches pre-policy grading contract (backward compatible).
 */
const DEFAULT_GRADING_POLICY = {
  version: 1,
  missingAssignment: {
    mode: 'count_as_zero', // 'count_as_zero' | 'exclude_until_graded'
  },
  latePenalty: {
    enabled: false,
    mode: 'per_day', // 'fixed' | 'per_day'
    fixedPercent: 10,
    perDayPercent: 5,
    gracePeriodHours: 0,
    capPercent: 100,
  },
  dropLowest: {
    enabled: false,
    rules: [], // { groupName: string, count: number }
  },
  categoryCaps: {
    enabled: false,
    caps: [], // { groupName: string, maxWeightPercent: number }
  },
  attendance: {
    mode: 'weighted_group', // 'weighted_group' | 'excluded' | 'separate_weight'
    groupName: 'Attendance',
    weightPercent: null,
  },
  gpaScale: {
    type: 'letter', // 'letter' | 'four_point' | 'percentage'
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
};

const DEFAULT_GRADE_SCALE = [
  { letter: 'A', min: 90, max: 100 },
  { letter: 'B', min: 80, max: 89 },
  { letter: 'C', min: 70, max: 79 },
  { letter: 'D', min: 60, max: 69 },
  { letter: 'F', min: 0, max: 59 },
];

module.exports = {
  DEFAULT_GRADING_POLICY,
  DEFAULT_GRADE_SCALE,
};
