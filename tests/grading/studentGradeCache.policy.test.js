const {
  studentCourseGradeCacheKey,
  invalidateStudentCourseGrade,
  STUDENT_GRADE_CACHE_PREFIX,
} = require('../../services/workflowCache.service');

jest.mock('../../utils/cache', () => ({
  delJson: jest.fn().mockResolvedValue(undefined),
  deleteKeysByPrefix: jest.fn().mockResolvedValue(undefined),
  getJson: jest.fn().mockResolvedValue(null),
  setJson: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/dashboardGradeSummary.service', () => ({
  scheduleRefreshStudents: jest.fn(),
  scheduleRefreshCourse: jest.fn(),
}));

const { delJson, deleteKeysByPrefix } = require('../../utils/cache');

describe('student course grade cache keys', () => {
  it('uses v5 key with policy hash', () => {
    const key = studentCourseGradeCacheKey('student1', 'course1', 'abc123hash');
    expect(key).toBe(`${STUDENT_GRADE_CACHE_PREFIX}:v5:student1:course:course1:abc123hash`);
  });

  it('changes cache key when policy hash changes', () => {
    const a = studentCourseGradeCacheKey('s1', 'c1', 'hash-old');
    const b = studentCourseGradeCacheKey('s1', 'c1', 'hash-new');
    expect(a).not.toBe(b);
  });

  it('invalidates v3, v4, and all v5 keys for a student course', async () => {
    await invalidateStudentCourseGrade('student42', 'course99');
    expect(delJson).toHaveBeenCalledWith(`${STUDENT_GRADE_CACHE_PREFIX}:v3:student42:course:course99`);
    expect(delJson).toHaveBeenCalledWith(`${STUDENT_GRADE_CACHE_PREFIX}:v4:student42:course:course99`);
    expect(deleteKeysByPrefix).toHaveBeenCalledWith(
      `${STUDENT_GRADE_CACHE_PREFIX}:v5:student42:course:course99:`
    );
  });
});
