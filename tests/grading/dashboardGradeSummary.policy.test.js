jest.mock('../../services/dashboardGradeSummary.service', () => ({
  scheduleRefreshStudents: jest.fn(),
  scheduleRefreshCourse: jest.fn(),
}));

jest.mock('../../utils/cache', () => ({
  delJson: jest.fn().mockResolvedValue(undefined),
  deleteKeysByPrefix: jest.fn().mockResolvedValue(undefined),
  getJson: jest.fn().mockResolvedValue(null),
  setJson: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../models/course.model', () => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        students: [{ _id: 'student1' }, { _id: 'student2' }],
      }),
    }),
  }),
}));

const {
  scheduleRefreshStudents,
  scheduleRefreshCourse,
} = require('../../services/dashboardGradeSummary.service');

const {
  invalidateStudentCourseGrade,
  invalidateAllStudentCourseGrades,
} = require('../../services/workflowCache.service');

describe('dashboard grade summary hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects stale summaries when policy hash changes', () => {
    const { isSummaryStale } = jest.requireActual('../../services/dashboardGradeSummary.service');
    expect(isSummaryStale({ computedAt: new Date(), policyHash: 'old' }, 'new', '1.0')).toBe(true);
    expect(isSummaryStale({ computedAt: new Date(), policyHash: 'same' }, 'same', '1.0')).toBe(
      false
    );
    expect(isSummaryStale(null, 'hash', '1.0')).toBe(true);
  });

  it('schedules student refresh when a single student grade cache is invalidated', async () => {
    await invalidateStudentCourseGrade('student42', 'course99');
    expect(scheduleRefreshStudents).toHaveBeenCalledWith('course99', ['student42']);
  });

  it('schedules full course refresh when all student caches are invalidated', async () => {
    await invalidateAllStudentCourseGrades('course99');
    expect(scheduleRefreshCourse).toHaveBeenCalledWith('course99');
  });

  it('normalizes object ids', () => {
    const { normalizeId } = jest.requireActual('../../services/dashboardGradeSummary.service');
    expect(normalizeId({ _id: 'abc123' })).toBe('abc123');
    expect(normalizeId('xyz')).toBe('xyz');
  });
});
