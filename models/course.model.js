const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Course instructor is required']
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  gradeScale: {
    type: [
      {
        letter: { type: String, required: true },
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      }
    ],
    default: [
      { letter: 'A', min: 94, max: 100 },
      { letter: 'A-', min: 90, max: 94 },
      { letter: 'B+', min: 87, max: 90 },
      { letter: 'B', min: 84, max: 87 },
      { letter: 'B-', min: 80, max: 84 },
      { letter: 'C+', min: 77, max: 80 },
      { letter: 'C', min: 74, max: 77 },
      { letter: 'D', min: 64, max: 74 },
      { letter: 'F', min: 0, max: 64 }
    ]
  },
  groups: {
    type: [
      {
        name: { type: String, required: true },
        weight: { type: Number, required: true }
      }
    ],
    default: []
  },
  published: {
    type: Boolean,
    default: false
  },
  overviewConfig: {
    type: {
      showLatestAnnouncements: { type: Boolean, default: false },
      numberOfAnnouncements: { type: Number, default: 3, min: 1, max: 10 }
    },
    default: {
      showLatestAnnouncements: false,
      numberOfAnnouncements: 3
    }
  }
}, {
  timestamps: true // This will add createdAt and updatedAt fields
});

module.exports = mongoose.model('Course', courseSchema); 