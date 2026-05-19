jest.mock('../models/attendance.model', () => ({
  find: jest.fn(),
  findOneAndDelete: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock('../models/course.model', () => ({
  findById: jest.fn()
}));

const Attendance = require('../models/attendance.model');
const Course = require('../models/course.model');
const attendanceController = require('../controllers/attendance.controller');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/attendance.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAttendance validates course id', async () => {
    const req = { params: { courseId: 'bad-id' }, query: { date: '2026-01-01' } };
    const res = createRes();

    await attendanceController.getAttendance(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid course ID' });
  });

  test('saveAttendance blocks non-instructor/non-admin', async () => {
    Course.findById.mockResolvedValue({ instructor: { toString: () => 'instructor-1' } });

    const req = {
      params: { courseId: '507f1f77bcf86cd799439011' },
      body: { date: '2026-01-01', attendanceData: [{ studentId: 's1', status: 'present' }] },
      user: { _id: 'student-1', role: 'student' }
    };
    const res = createRes();

    await attendanceController.saveAttendance(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Only instructors can mark attendance' });
  });

  test('getAttendanceStats blocks student role', async () => {
    const req = {
      params: { courseId: '507f1f77bcf86cd799439011' },
      query: {},
      user: { role: 'student' }
    };
    const res = createRes();

    await attendanceController.getAttendanceStats(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Only teachers and admins can access attendance statistics' });
  });

  test('getAttendanceStats applies date filter and returns stats', async () => {
    Attendance.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        { status: 'present', student: { _id: 's1', firstName: 'A', lastName: 'B' } }
      ])
    });

    const req = {
      params: { courseId: '507f1f77bcf86cd799439011' },
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
      user: { role: 'teacher' }
    };
    const res = createRes();

    await attendanceController.getAttendanceStats(req, res);

    expect(Attendance.find).toHaveBeenCalledWith(expect.objectContaining({
      course: '507f1f77bcf86cd799439011',
      date: expect.any(Object)
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      totalRecords: 1,
      present: 1
    }));
  });
});

