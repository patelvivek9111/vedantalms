/**
 * Canvas-like grading period deletion: unassign items, preserve grades, no auto-re-slot.
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { applyJestExportPaths } = require('../exportPaths');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const CourseGradingPeriod = require('../../models/courseGradingPeriod.model');
const gradingPeriodService = require('../../services/gradingPeriod.service');
const gradingPeriodAssignmentService = require('../../services/gradingPeriodAssignment.service');

describe('grading period delete (Canvas-like)', () => {
  let mongoServer;
  let courseId;
  let teacherId;
  let periodQ1;
  let periodQ2;
  let assignmentId;

  beforeAll(async () => {
    applyJestExportPaths();
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    const teacher = await User.create({
      firstName: 'Period',
      lastName: 'Teacher',
      email: `period.delete.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    teacherId = teacher._id;

    const course = await Course.create({
      title: 'Period Delete Course',
      description: 'Test',
      instructor: teacherId,
      groups: [{ name: 'Assignments', weight: 100 }],
    });
    courseId = course._id;

    periodQ1 = await gradingPeriodService.createGradingPeriod(
      courseId,
      { name: 'Quarter 1', weight: 40 },
      teacherId
    );
    periodQ2 = await gradingPeriodService.createGradingPeriod(
      courseId,
      { name: 'Quarter 2', weight: 40 },
      teacherId
    );

    const mod = await Module.create({ course: courseId, title: 'Module 1', order: 0, published: true });
    const assignment = await Assignment.create({
      module: mod._id,
      title: 'Quiz 1',
      description: 'Quiz',
      gradingPeriodId: periodQ1._id,
      totalPoints: 100,
      published: true,
      group: 'Assignments',
      createdBy: teacherId,
      dueDate: new Date('2025-09-15'),
      availableFrom: new Date('2025-08-01'),
      questions: [{ id: 'q1', type: 'text', text: 'Q1', points: 100 }],
    });
    assignmentId = assignment._id;
  }, 60000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('reports deletion impact before removing a period', async () => {
    const impact = await gradingPeriodService.getDeletionImpact(periodQ1._id, courseId);
    expect(impact).toBeTruthy();
    expect(impact.assignmentCount).toBe(1);
    expect(impact.hasAssignmentsOrGrades).toBe(true);
    expect(impact.weightWarning).toMatch(/not 100/);
    expect(impact.preservesSnapshots).toBe(true);
  });

  it('unassigns items instead of re-slotting into remaining periods', async () => {
    const result = await gradingPeriodService.deleteGradingPeriod(periodQ1._id, courseId);
    expect(result).toBeTruthy();
    expect(result.assignmentsUnassigned).toBe(1);
    expect(result.preservesSnapshots).toBe(true);

    const assignment = await Assignment.findById(assignmentId).lean();
    expect(assignment.gradingPeriodId).toBeNull();

    const remaining = await CourseGradingPeriod.find({ course: courseId }).lean();
    expect(remaining).toHaveLength(1);
    expect(String(remaining[0]._id)).toBe(String(periodQ2._id));

    // Reconcile would move Quiz 1 into Q2 — verify it stayed unassigned.
    const reconciled = await gradingPeriodAssignmentService.reconcileCoursePeriodAssignments(
      courseId
    );
    expect(reconciled.assignmentsUpdated).toBe(1);
    const afterReconcile = await Assignment.findById(assignmentId).lean();
    expect(String(afterReconcile.gradingPeriodId)).toBe(String(periodQ2._id));
  });

  it('buildWeightWarning flags incomplete weights', () => {
    expect(gradingPeriodService.buildWeightWarning([{ weight: 40 }, { weight: 30 }])).toMatch(
      /not 100/
    );
    expect(gradingPeriodService.buildWeightWarning([{ weight: 50 }, { weight: 50 }])).toBeNull();
  });
});
