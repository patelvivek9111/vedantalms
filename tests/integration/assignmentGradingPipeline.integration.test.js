const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const User = require('../../models/user.model');
const submissionController = require('../../controllers/submission.controller');
const gradeReleaseService = require('../../services/gradeRelease.service');

jest.mock('../../services/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('assignment grading pipeline Map serialization', () => {
  let mongoServer;
  let teacher;
  let student;
  let course;
  let moduleDoc;
  let assignment;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    teacher = await User.create({
      firstName: 'Pipeline',
      lastName: 'Teacher',
      email: `pipeline-teacher-${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    student = await User.create({
      firstName: 'Pipeline',
      lastName: 'Student',
      email: `pipeline-student-${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    course = await Course.create({
      title: 'Pipeline Course',
      description: 'Integration grading pipeline',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    moduleDoc = await Module.create({
      title: 'Week 1',
      course: course._id,
      published: true,
    });

    assignment = await Assignment.create({
      title: 'Pipeline Quiz',
      description: 'End-to-end grading test',
      module: moduleDoc._id,
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
      published: true,
      totalPoints: 2,
      gradeReleaseMode: 'manual',
      questions: [
        { text: 'Short answer', type: 'text', points: 1 },
        {
          text: 'Multiple choice',
          type: 'multiple-choice',
          points: 1,
          options: [
            { text: 'wrong', isCorrect: false },
            { text: 'right', isCorrect: true },
          ],
        },
      ],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  test('createSubmission round-trips answers through API response', async () => {
    const req = {
      user: student,
      headers: {},
      body: {
        assignment: String(assignment._id),
        answers: { 0: 'my text answer', 1: 'right' },
      },
      ip: '127.0.0.1',
      requestId: 'pipeline-create',
    };
    const res = createRes();

    await submissionController.createSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBeUndefined();
    expect(payload.answers).toEqual({ 0: 'my text answer', 1: 'right' });
    expect(Object.keys(payload.answers)).toHaveLength(2);

    const stored = await Submission.findById(payload._id);
    expect(stored.answers instanceof Map).toBe(true);
    expect(stored.answers.get('0')).toBe('my text answer');
  });

  test('getStudentSubmission serializes answers for enrolled student', async () => {
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });
    expect(submission).toBeTruthy();

    const req = {
      params: { assignmentId: String(assignment._id) },
      user: student,
    };
    const res = createRes();

    await submissionController.getStudentSubmission(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.answers).toEqual({ 0: 'my text answer', 1: 'right' });
    expect(payload.gradeVisibility.mode).toBe('hidden');
    expect(payload.grade).toBeUndefined();
  });

  test('getSubmissionById returns serialized answers to staff', async () => {
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });

    const req = {
      params: { id: String(submission._id) },
      user: teacher,
    };
    const res = createRes();

    await submissionController.getSubmissionById(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.answers).toEqual({ 0: 'my text answer', 1: 'right' });
  });

  test('gradeSubmission returns serialized answers and questionGrades', async () => {
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });

    const req = {
      params: { id: String(submission._id) },
      user: teacher,
      headers: {},
      body: {
        questionGrades: { 0: 1, 1: 1 },
        feedback: 'Well done',
        releaseGrade: true,
        releaseFeedback: true,
      },
      ip: '127.0.0.1',
      requestId: 'pipeline-grade',
    };
    const res = createRes();

    await submissionController.gradeSubmission(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.answers).toEqual({ 0: 'my text answer', 1: 'right' });
    expect(payload.questionGrades).toEqual({ 0: 1, 1: 1 });
    expect(payload.feedback).toBe('Well done');
    expect(payload.grade).toBe(2);
  });

  test('redactSubmissionForStudent preserves answers but hides grades before release', async () => {
    const doc = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });
    doc.gradeHidden = true;
    doc.gradesReleasedAt = undefined;
    doc.feedbackReleasedAt = undefined;

    const redacted = gradeReleaseService.redactSubmissionForStudent(doc, assignment);
    expect(redacted.answers).toEqual({ 0: 'my text answer', 1: 'right' });
    expect(redacted.grade).toBeUndefined();
    expect(redacted.questionGrades).toBeUndefined();
    expect(redacted.feedback).toBeUndefined();
  });

  test('getStudentSubmission exposes grade after manual release', async () => {
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });
    submission.gradesReleasedAt = new Date();
    submission.feedbackReleasedAt = new Date();
    submission.gradeHidden = false;
    await submission.save();

    const req = {
      params: { assignmentId: String(assignment._id) },
      user: student,
    };
    const res = createRes();

    await submissionController.getStudentSubmission(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.answers).toEqual({ 0: 'my text answer', 1: 'right' });
    expect(payload.grade).toBe(2);
    expect(payload.feedback).toBe('Well done');
    expect(payload.gradeVisibility.mode).toBe('score_and_feedback');
  });
});
