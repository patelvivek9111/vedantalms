const { resolveGradingPolicy } = require('../../shared/grading/policyResolver.cjs');
const { DEFAULT_GRADING_POLICY } = require('../../shared/grading/policyDefaults.cjs');

describe('resolveGradingPolicy', () => {
  it('defaults match legacy contract when only course embedded fields exist', () => {
    const course = {
      groups: [{ name: 'Assignments', weight: 100 }],
      gradeScale: [{ letter: 'A', min: 90, max: 100 }],
    };
    const resolved = resolveGradingPolicy({ course });
    expect(resolved.missingAssignment.mode).toBe(DEFAULT_GRADING_POLICY.missingAssignment.mode);
    expect(resolved.groups).toEqual(course.groups);
    expect(resolved.latePenalty.enabled).toBe(false);
  });

  it('course policy overrides institution defaults', () => {
    const institutionPolicy = {
      policy: { latePenalty: { enabled: true, mode: 'fixed', fixedPercent: 5 } },
    };
    const coursePolicy = {
      policy: { latePenalty: { enabled: false } },
    };
    const course = { groups: [{ name: 'A', weight: 100 }] };
    const resolved = resolveGradingPolicy({ course, institutionPolicy, coursePolicy });
    expect(resolved.latePenalty.enabled).toBe(false);
  });

  it('teacher override wins over course', () => {
    const coursePolicy = {
      policy: { missingAssignment: { mode: 'count_as_zero' } },
    };
    const teacherPolicy = {
      policy: { missingAssignment: { mode: 'exclude_until_graded' } },
    };
    const course = { groups: [{ name: 'A', weight: 100 }] };
    const resolved = resolveGradingPolicy({ course, coursePolicy, teacherPolicy });
    expect(resolved.missingAssignment.mode).toBe('exclude_until_graded');
  });

  it('excludes attendance group when mode is excluded', () => {
    const course = {
      groups: [
        { name: 'Assignments', weight: 80 },
        { name: 'Attendance', weight: 20 },
      ],
    };
    const coursePolicy = {
      policy: { attendance: { mode: 'excluded', groupName: 'Attendance' } },
    };
    const resolved = resolveGradingPolicy({ course, coursePolicy });
    expect(resolved.groups.find((g) => g.name === 'Attendance')).toBeUndefined();
  });

  it('retroactive apply mode omits legacy policy even when snapshot is stored', () => {
    const course = { groups: [{ name: 'Assignments', weight: 100 }] };
    const coursePolicy = {
      applyMode: 'retroactive_all',
      legacyPolicySnapshot: {
        missingAssignment: { mode: 'exclude_until_graded' },
        version: 1,
      },
      policy: { missingAssignment: { mode: 'count_as_zero' } },
    };
    const resolved = resolveGradingPolicy({ course, coursePolicy });
    expect(resolved.missingAssignment.mode).toBe('count_as_zero');
    expect(resolved.policyApplication.applyMode).toBe('retroactive_all');
    expect(resolved.policyApplication.legacyPolicy).toBeNull();
  });
});
