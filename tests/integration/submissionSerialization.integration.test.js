const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Submission = require('../../models/Submission');
const Assignment = require('../../models/Assignment');
const User = require('../../models/user.model');
const submissionController = require('../../controllers/submission.controller');
const assignmentController = require('../../controllers/assignment.controller');
const { serializeSubmissionForApi } = require('../../utils/submissionResponse');
const { readMapField } = require('../../utils/mongooseSerialize');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('submission Map serialization integration', () => {
  let mongoServer;
  let teacher;
  let student;
  let assignment;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    teacher = await User.create({
      firstName: 'Grade',
      lastName: 'Teacher',
      email: `map-serialize-teacher-${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    student = await User.create({
      firstName: 'Answer',
      lastName: 'Student',
      email: `map-serialize-student-${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    assignment = await Assignment.create({
      title: 'Map Serialization Quiz',
      description: 'Integration test assignment',
      module: new mongoose.Types.ObjectId(),
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
      published: true,
      totalPoints: 3,
      questions: [
        { text: 'Text Q', type: 'text', points: 1 },
        {
          text: 'MC Q',
          type: 'multiple-choice',
          points: 1,
          options: [
            { text: 'wrong', isCorrect: false },
            { text: 'right', isCorrect: true },
          ],
        },
        { text: 'Match Q', type: 'matching', points: 1, leftItems: [], rightItems: [] },
      ],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  test('schema flattenMaps keeps answers in toObject and JSON', async () => {
    const created = await Submission.create({
      assignment: assignment._id,
      student: student._id,
      submittedBy: student._id,
      answers: { 0: 'student text', 1: 'right', 2: '{"0":"x"}' },
      autoGraded: true,
      autoQuestionGrades: { 0: 0, 1: 1, 2: 0 },
      submittedAt: new Date(),
    });

    const doc = await Submission.findById(created._id);
    expect(doc.answers instanceof Map).toBe(true);
    expect(doc.toObject().answers).toEqual({
      0: 'student text',
      1: 'right',
      2: '{"0":"x"}',
    });
    expect(JSON.parse(JSON.stringify(doc)).answers).toEqual({
      0: 'student text',
      1: 'right',
      2: '{"0":"x"}',
    });
    expect(serializeSubmissionForApi(doc).answers).toEqual({
      0: 'student text',
      1: 'right',
      2: '{"0":"x"}',
    });
  });

  test('getAssignmentSubmissions returns non-empty answers to teachers', async () => {
    const created = await Submission.create({
      assignment: assignment._id,
      student: student._id,
      submittedBy: student._id,
      answers: { 0: 'visible answer', 1: 'right' },
      submittedAt: new Date(),
    });

    const req = {
      params: { assignmentId: String(assignment._id) },
      query: {},
      user: { _id: teacher._id },
    };
    const res = createRes();

    await submissionController.getAssignmentSubmissions(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    const row = payload.data.find((s) => String(s._id) === String(created._id));
    expect(row).toBeTruthy();
    expect(row.answers).toEqual({ 0: 'visible answer', 1: 'right' });
  });

  test('assignment stats reads answers from Mongoose Map documents', async () => {
    await Submission.deleteMany({ assignment: assignment._id });
    await Submission.create({
      assignment: assignment._id,
      student: student._id,
      submittedBy: student._id,
      answers: { 1: 'right' },
      submittedAt: new Date(),
    });

    const doc = await Submission.findOne({ assignment: assignment._id });
    expect(readMapField(doc.answers, 1)).toBe('right');

    const req = { params: { id: String(assignment._id) }, user: { _id: teacher._id } };
    const res = createRes();
    await assignmentController.getAssignmentStats(req, res);

    const stats = res.json.mock.calls[0][0].stats;
    const mcStats = stats.questionStats.find((q) => q.questionIndex === 1);
    expect(mcStats.correctCount).toBe(1);
    expect(mcStats.incorrectCount).toBe(0);
  });

  test('createOrUpdateManualGrade returns serialized answers', async () => {
    const offlineAssignment = await Assignment.create({
      title: 'Offline grade test',
      description: 'Offline',
      module: new mongoose.Types.ObjectId(),
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
      published: true,
      isOfflineAssignment: true,
      totalPoints: 10,
    });

    const req = {
      body: {
        assignmentId: String(offlineAssignment._id),
        studentId: String(student._id),
        grade: 8,
        feedback: 'Good work',
      },
      user: { _id: teacher._id, role: 'teacher' },
      ip: '127.0.0.1',
      requestId: 'test',
    };
    const res = createRes();

    await submissionController.createOrUpdateManualGrade(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.grade).toBe(8);
    expect(payload.feedback).toBe('Good work');
    expect(payload.answers).toBeDefined();
  });
});
