/**
 * Shared Mongo + JWT context for Day 3 / Day 5 load scripts (local DB must match API).
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const ConversationParticipant = require('../../models/ConversationParticipant');

const buildLoadTestContext = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '5000', 10)
  });

  const courseWithStudents = await Course.findOne({
    instructor: { $ne: null },
    students: { $exists: true, $not: { $size: 0 } }
  }).select('_id instructor students').lean();

  let student = null;
  let teacher = null;
  let studentCourseId = null;
  let teacherCourseId = null;

  if (courseWithStudents && Array.isArray(courseWithStudents.students) && courseWithStudents.students.length > 0) {
    student = await User.findById(courseWithStudents.students[0]).select('_id role').lean();
    teacher = await User.findById(courseWithStudents.instructor).select('_id role').lean();
    studentCourseId = String(courseWithStudents._id);
    teacherCourseId = String(courseWithStudents._id);
  } else {
    student = await User.findOne({ role: 'student' }).select('_id role').lean();
    teacher = await User.findOne({ role: { $in: ['teacher', 'admin'] } }).select('_id role').lean();
    if (student) {
      const studentCourse = await Course.findOne({ students: student._id }).select('_id').lean();
      if (studentCourse) studentCourseId = String(studentCourse._id);
    }
    if (teacher) {
      const teacherCourse = await Course.findOne({ instructor: teacher._id }).select('_id').lean();
      if (teacherCourse) teacherCourseId = String(teacherCourse._id);
    }
  }

  if (!student && teacher) {
    student = teacher;
  }
  if (!teacher && student) {
    teacher = student;
  }
  if (!student || !teacher) {
    throw new Error('No benchmark users found in database');
  }

  let conversation = await ConversationParticipant.findOne({ userId: student._id }).select('conversationId').lean();
  if (!conversation) {
    conversation = await ConversationParticipant.findOne({ userId: teacher._id }).select('conversationId').lean();
  }

  const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-123';
  const studentToken = jwt.sign({ id: student._id, role: student.role }, jwtSecret, { expiresIn: '30m' });
  const teacherToken = jwt.sign({ id: teacher._id, role: teacher.role }, jwtSecret, { expiresIn: '30m' });

  return {
    studentToken,
    teacherToken,
    studentCourseId,
    teacherCourseId,
    conversationId: conversation ? String(conversation.conversationId) : null
  };
};

module.exports = { buildLoadTestContext };
