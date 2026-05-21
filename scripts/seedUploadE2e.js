/**
 * Seeds deterministic users/course/page/file for upload E2E (local dev DB).
 * Writes e2e/.env.local for Playwright and prints a one-line JSON summary.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const FileAsset = require('../models/fileAsset.model');

const PASSWORD = process.env.E2E_UPLOAD_PASSWORD || 'TestUpload123!';
const USERS = {
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL || 'teacher.upload.e2e@example.com',
    firstName: 'Upload',
    lastName: 'Teacher',
    role: 'teacher',
  },
  student: {
    email: process.env.E2E_STUDENT_EMAIL || 'student.upload.e2e@example.com',
    firstName: 'Upload',
    lastName: 'Student',
    role: 'student',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin.upload.e2e@example.com',
    firstName: 'Upload',
    lastName: 'Admin',
    role: 'admin',
  },
};

const COURSE_TITLE = 'Upload E2E Harness Course';
const E2E_ENV_PATH = path.join(__dirname, '..', 'e2e', '.env.local');

async function upsertUser(def) {
  let user = await User.findOne({ email: def.email });
  if (user) {
    user.role = def.role;
    user.firstName = def.firstName;
    user.lastName = def.lastName;
    user.password = PASSWORD;
    await user.save();
    return user;
  }
  return User.create({
    email: def.email,
    password: PASSWORD,
    role: def.role,
    firstName: def.firstName,
    lastName: def.lastName,
  });
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms';
  await mongoose.connect(uri);

  const teacher = await upsertUser(USERS.teacher);
  const student = await upsertUser(USERS.student);
  const admin = await upsertUser(USERS.admin);

  let course = await Course.findOne({ title: COURSE_TITLE });
  if (!course) {
    course = await Course.create({
      title: COURSE_TITLE,
      description: 'Deterministic course for upload platform E2E',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Spring', year: 2026 },
    });
  } else {
    course.instructor = teacher._id;
    course.students = [student._id];
    course.published = true;
    await course.save();
  }

  let module = await Module.findOne({ course: course._id, title: 'Upload E2E Module' });
  if (!module) {
    module = await Module.create({
      title: 'Upload E2E Module',
      course: course._id,
      published: true,
    });
  }

  let page = await Page.findOne({ module: module._id, title: 'Upload E2E Page' });
  if (!page) {
    page = await Page.create({
      title: 'Upload E2E Page',
      module: module._id,
      content: '<p>E2E attachment panel target</p>',
      published: true,
    });
  }

  const storageKey = `e2e-deleted-${course._id}`;
  let deletedFile = await FileAsset.findOne({ storageKey });
  if (!deletedFile) {
    deletedFile = await FileAsset.create({
      storageKey,
      provider: 'local',
      path: '/uploads/e2e/deleted-sample.pdf',
      originalName: 'deleted-sample.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      uploadedBy: teacher._id,
      courseId: course._id,
      category: 'page',
      isDeleted: true,
      deletedAt: new Date(),
    });
  } else {
    deletedFile.isDeleted = true;
    deletedFile.deletedAt = deletedFile.deletedAt || new Date();
    await deletedFile.save();
  }

  const baseURL =
    process.env.E2E_BASE_URL || process.env.VITE_DEV_URL || 'http://localhost:3001';
  const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';

  const envLines = [
    `E2E_API_URL=${apiURL}`,
    `E2E_BASE_URL=${baseURL}`,
    `E2E_TEACHER_EMAIL=${teacher.email}`,
    `E2E_TEACHER_PASSWORD=${PASSWORD}`,
    `E2E_STUDENT_EMAIL=${student.email}`,
    `E2E_STUDENT_PASSWORD=${PASSWORD}`,
    `E2E_ADMIN_EMAIL=${admin.email}`,
    `E2E_ADMIN_PASSWORD=${PASSWORD}`,
    `E2E_COURSE_ID=${course._id.toString()}`,
    `E2E_PAGE_EDIT_URL=${baseURL}/pages/${page._id.toString()}/edit`,
    `E2E_DELETED_FILE_ID=${deletedFile._id.toString()}`,
  ];

  fs.writeFileSync(E2E_ENV_PATH, `${envLines.join('\n')}\n`, 'utf8');

  const summary = {
    envFile: E2E_ENV_PATH,
    courseId: course._id.toString(),
    pageEditUrl: `${baseURL}/pages/${page._id.toString()}/edit`,
    deletedFileId: deletedFile._id.toString(),
  };

  console.log('Upload E2E seed complete.');
  console.log(JSON.stringify(summary));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
