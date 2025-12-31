const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dueDate: { type: Date, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  // New fields for enrollment notifications
  type: { 
    type: String, 
    enum: ['general', 'enrollment_request', 'enrollment_summary', 'waitlist_promotion'], 
    default: 'general' 
  },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional - only used for individual notifications
  action: { 
    type: String, 
    enum: ['approve', 'deny', 'pending'], 
    default: 'pending' 
  },
  // For consolidated enrollment notifications
  enrollmentCount: { type: Number, default: 0 },
  courseName: { type: String }
});

module.exports = mongoose.model('Todo', todoSchema); 