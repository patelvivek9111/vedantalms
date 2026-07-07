jest.mock('../../../services/gradeCalculation.service', () => ({
  calculateCourseGradeForStudent: jest.fn(),
  toStudentGradeApiResponse: jest.fn((r) => r),
}));

jest.mock('../../../services/gradingPolicy.service', () => ({
  getCourseGradingContext: jest.fn(),
}));

jest.mock('../../../shared/grading/policySnapshot.cjs', () => ({
  generateResolvedPolicySnapshot: jest.fn(() => ({ policyHash: 'test-policy-hash' })),
}));

jest.mock('../../../shared/grading/gradingEngineVersion.cjs', () => ({
  getGradingEngineVersion: jest.fn(() => '1.0.0-test'),
}));

jest.mock('../../../services/workflowCache.service', () => ({
  studentCourseGradeCacheKey: jest.fn(() => 'student-grade-cache-key'),
}));

jest.mock('../../../models/Submission', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn()
}));

jest.mock('../../../models/Assignment', () => ({
  findById: jest.fn()
}));

jest.mock('../../../models/Group', () => ({
  findById: jest.fn()
}));

jest.mock('../../../models/course.model', () => ({
  findById: jest.fn()
}));

jest.mock('../../../models/module.model', () => ({
  find: jest.fn()
}));

jest.mock('../../../models/thread.model', () => ({
  find: jest.fn()
}));

jest.mock('../../../models/GroupSet', () => ({
  find: jest.fn()
}));

jest.mock('../../../utils/cache', () => ({
  getJson: jest.fn(),
  setJson: jest.fn(),
}));

jest.mock('../../../utils/gradeCalculation', () => ({
  calculateFinalGradeWithWeightedGroups: jest.fn().mockReturnValue(88),
  getLetterGrade: jest.fn().mockReturnValue('B+'),
  resolveAssignmentGrade: jest.fn(),
  buildGradesMapForStudent: jest.fn(),
  EXCUSED_GRADE: 'excused',
}));

jest.mock('../../../services/notification', () => ({
  createNotification: jest.fn()
}));

const Assignment = require('../../../models/Assignment');
const Course = require('../../../models/course.model');
const Module = require('../../../models/module.model');
const Submission = require('../../../models/Submission');
const Thread = require('../../../models/thread.model');
const GroupSet = require('../../../models/GroupSet');
const { getJson, setJson } = require('../../../utils/cache');
const { calculateCourseGradeForStudent } = require('../../../services/gradeCalculation.service');
const gradingPolicyService = require('../../../services/gradingPolicy.service');
const submissionController = require('../../../controllers/submission.controller');
const gradesController = require('../../../controllers/grades.controller');

const mockCourseLean = (course) => ({
  lean: jest.fn().mockResolvedValue(course),
});

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/submission + grades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gradingPolicyService.getCourseGradingContext.mockResolvedValue({
      resolved: { missingAssignment: { mode: 'count_as_zero' } },
    });
  });

  test('createSubmission rejects non-student roles', async () => {
    const req = {
      user: { _id: 'u1', role: 'teacher' },
      body: { assignment: 'a1', answers: { q1: 'x' } }
    };
    const res = createRes();

    await submissionController.createSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Only students can submit assignments' });
  });

  test('createSubmission returns 404 when assignment does not exist', async () => {
    Assignment.findById.mockResolvedValue(null);
    const req = {
      user: { _id: 'u1', role: 'student' },
      body: { assignment: 'a1', answers: { q1: 'x' } }
    };
    const res = createRes();

    await submissionController.createSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Assignment not found' });
  });

  test('getStudentCourseGrade returns cached response when available', async () => {
    getJson.mockResolvedValue({ totalPercent: 92, letterGrade: 'A-' });
    Course.findById.mockReturnValue(mockCourseLean({ _id: 'c1', gradeScale: [] }));
    const req = { params: { courseId: 'c1' }, user: { _id: 'u1' } };
    const res = createRes();

    await gradesController.getStudentCourseGrade(req, res);

    expect(res.json).toHaveBeenCalledWith({ totalPercent: 92, letterGrade: 'A-' });
    expect(calculateCourseGradeForStudent).not.toHaveBeenCalled();
  });

  test('getStudentCourseGrade returns 404 when course is missing', async () => {
    getJson.mockResolvedValue(null);
    Course.findById.mockReturnValue(mockCourseLean(null));
    const req = { params: { courseId: 'c1' }, user: { _id: 'u1' } };
    const res = createRes();

    await gradesController.getStudentCourseGrade(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Course not found' });
    expect(calculateCourseGradeForStudent).not.toHaveBeenCalled();
  });

  test('getStudentCourseGrade delegates to calculateCourseGradeForStudent on cache miss', async () => {
    getJson.mockResolvedValue(null);
    setJson.mockResolvedValue(undefined);
    Course.findById.mockReturnValue(
      mockCourseLean({ _id: 'c1', gradeScale: [] }),
    );
    calculateCourseGradeForStudent.mockResolvedValue({
      currentPercent: 88,
      finalPercent: 75,
      totalPercent: 88,
      letterGrade: 'B+',
      finalLetterGrade: 'C',
    });

    const req = { params: { courseId: 'c1' }, user: { _id: 'u1' } };
    const res = createRes();

    await gradesController.getStudentCourseGrade(req, res);

    expect(calculateCourseGradeForStudent).toHaveBeenCalledWith('u1', {
      _id: 'c1',
      gradeScale: [],
    });
    expect(setJson).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ currentPercent: 88, finalPercent: 75, totalPercent: 88 })
    );
  });
});

