#!/usr/bin/env node
/**
 * Seed deterministic users + course catalog for capacity / load testing.
 * Usage: node scripts/load/seedCapacityFixtures.js
 * Env: CAPACITY_STUDENT_COUNT=500 CAPACITY_ASSIGNMENT_COUNT=30 CAPACITY_THREAD_COUNT=15
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Thread = require('../../models/thread.model');
const { writeReport } = require('./loadBenchUtils');

const PREFIX = process.env.CAPACITY_SEED_PREFIX || 'capacity-load';
const STUDENT_COUNT = parseInt(process.env.CAPACITY_STUDENT_COUNT || '500', 10);
const ASSIGNMENT_COUNT = parseInt(process.env.CAPACITY_ASSIGNMENT_COUNT || '30', 10);
const THREAD_COUNT = parseInt(process.env.CAPACITY_THREAD_COUNT || '15', 10);
const PASSWORD = process.env.CAPACITY_PASSWORD || 'LoadTest123!';

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);

  const teacherEmail = `${PREFIX}-teacher@loadtest.com`;
  const adminEmail = `${PREFIX}-admin@loadtest.com`;

  await User.deleteMany({
    email: {
      $in: [
        teacherEmail,
        adminEmail,
        new RegExp(`^${PREFIX}-student\\d+@loadtest\\.com$`),
      ],
    },
  });
  await Course.deleteMany({ title: `${PREFIX} course` });
  await Module.deleteMany({ title: new RegExp(`^${PREFIX} module`) });
  await Assignment.deleteMany({ title: new RegExp(`^${PREFIX} assignment`) });
  await Thread.deleteMany({ title: new RegExp(`^${PREFIX} thread`) });

  const passwordHash = await hashPassword(PASSWORD);

  const teacher = await User.create({
    firstName: 'Load',
    lastName: 'Teacher',
    email: teacherEmail,
    password: PASSWORD,
    role: 'teacher',
  });

  const admin = await User.create({
    firstName: 'Load',
    lastName: 'Admin',
    email: adminEmail,
    password: PASSWORD,
    role: 'admin',
  });

  const studentDocs = [];
  for (let i = 0; i < STUDENT_COUNT; i += 1) {
    studentDocs.push({
      firstName: 'Student',
      lastName: String(i),
      email: `${PREFIX}-student${i}@loadtest.com`,
      password: passwordHash,
      role: 'student',
    });
  }

  const BATCH = 200;
  const students = [];
  for (let i = 0; i < studentDocs.length; i += BATCH) {
    const batch = await User.insertMany(studentDocs.slice(i, i + BATCH));
    students.push(...batch);
  }

  const course = await Course.create({
    title: `${PREFIX} course`,
    description: 'Capacity test course with large enrollment',
    instructor: teacher._id,
    students: students.map((s) => s._id),
    published: true,
    semester: { term: 'Fall', year: 2025 },
  });

  const moduleDoc = await Module.create({
    title: `${PREFIX} module 1`,
    course: course._id,
    published: true,
  });

  const now = Date.now();
  const assignments = [];
  for (let i = 0; i < ASSIGNMENT_COUNT; i += 1) {
    assignments.push({
      title: `${PREFIX} assignment ${i}`,
      description: 'Capacity workload assignment',
      module: moduleDoc._id,
      availableFrom: new Date(now - 7 * 86400000),
      dueDate: new Date(now + (i + 1) * 86400000),
      createdBy: teacher._id,
      published: true,
    });
  }
  const assignmentDocs = await Assignment.insertMany(assignments);

  const threads = [];
  for (let i = 0; i < THREAD_COUNT; i += 1) {
    threads.push({
      title: `${PREFIX} thread ${i}`,
      content: '<p>Capacity discussion thread</p>',
      course: course._id,
      author: teacher._id,
      published: true,
    });
  }
  const threadDocs = await Thread.insertMany(threads);

  const manifest = {
    seededAt: new Date().toISOString(),
    prefix: PREFIX,
    password: PASSWORD,
    counts: {
      students: students.length,
      assignments: assignmentDocs.length,
      threads: threadDocs.length,
    },
    teacher: { id: String(teacher._id), email: teacherEmail },
    admin: { id: String(admin._id), email: adminEmail },
    students: students.map((s) => ({ id: String(s._id), email: s.email })),
    course: { id: String(course._id), title: course.title },
    module: { id: String(moduleDoc._id) },
    assignmentIds: assignmentDocs.map((a) => String(a._id)),
    threadIds: threadDocs.map((t) => String(t._id)),
  };

  const out = writeReport('capacity-fixtures.json', manifest);
  console.log(JSON.stringify({ ok: true, manifest: out, counts: manifest.counts }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
