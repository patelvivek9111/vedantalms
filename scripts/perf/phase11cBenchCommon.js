const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../tests/mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const GroupSet = require('../../models/GroupSet');
const Group = require('../../models/Group');
const Notification = require('../../models/notification.model');

async function connectBenchMongo() {
  const mongoServer = await createMongoMemoryServer();
  await mongoose.connect(mongoServer.getUri());
  await Notification.syncIndexes();
  return mongoServer;
}

async function seedCourseWithStudents(studentCount, { prefix = 'bench' } = {}) {
  const teacher = await User.create({
    firstName: 'Bench',
    lastName: 'Teacher',
    email: `${prefix}-teacher-${Date.now()}@example.com`,
    password: 'password123',
    role: 'teacher',
  });

  const students = [];
  for (let i = 0; i < studentCount; i += 1) {
    students.push(
      await User.create({
        firstName: 'Student',
        lastName: String(i),
        email: `${prefix}-student-${i}-${Date.now()}@example.com`,
        password: 'password123',
        role: 'student',
      })
    );
  }

  const course = await Course.create({
    title: `Bench Course ${studentCount}`,
    description: 'Benchmark',
    instructor: teacher._id,
    students: students.map((s) => s._id),
    published: true,
    semester: { term: 'Fall', year: 2025 },
  });

  const moduleDoc = await Module.create({
    title: 'Week 1',
    course: course._id,
    published: true,
  });

  await Assignment.create({
    title: 'Benchmark Assignment',
    description: 'Work',
    module: moduleDoc._id,
    dueDate: new Date(Date.now() + 3 * 86400000),
    availableFrom: new Date(Date.now() - 86400000),
    createdBy: teacher._id,
    published: true,
  });

  const groupSet = await GroupSet.create({
    name: 'Bench Groups',
    course: course._id,
  });

  for (let i = 0; i < students.length; i += 1) {
    await Group.create({
      name: `Group ${i}`,
      groupSet: groupSet._id,
      course: course._id,
      groupId: `BENCH-${i}-${Date.now()}`,
      members: [students[i]._id],
    });
  }

  return { teacher, students, course, moduleDoc };
}

function summarizeRuns(runs) {
  const durations = runs.map((r) => r.durationMs);
  const failures = runs.filter((r) => !r.ok).length;
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

  return {
    runs: runs.length,
    successRate: (runs.length - failures) / runs.length,
    failures,
    durationMs: {
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      avg: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      p50,
      p95,
    },
  };
}

module.exports = {
  connectBenchMongo,
  seedCourseWithStudents,
  summarizeRuns,
};
