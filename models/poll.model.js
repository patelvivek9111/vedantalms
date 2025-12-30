const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  title: {
    type: String,
    required: [true, 'Poll title is required'],
    trim: true,
    maxlength: 200
  },

  options: [{
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true,
      maxlength: 200
    },
    votes: {
      type: Number,
      default: 0
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  allowMultipleVotes: {
    type: Boolean,
    default: false
  },
  studentVotes: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    selectedOptions: [{
      type: Number,
      required: true
    }],
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  resultsVisible: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
pollSchema.index({ course: 1, isActive: 1 });
pollSchema.index({ endDate: 1 });

// Virtual for total votes
pollSchema.virtual('totalVotes').get(function() {
  return this.options.reduce((sum, option) => sum + option.votes, 0);
});

// Add validation to ensure endDate is in the future when creating
pollSchema.pre('validate', function(next) {
  if (this.isNew && this.endDate) {
    if (new Date(this.endDate) <= new Date()) {
      this.invalidate('endDate', 'End date must be in the future');
    }
  }
  
  // Validate at least 2 options
  if (this.options && this.options.length < 2) {
    this.invalidate('options', 'Poll must have at least 2 options');
  }
  next();
});

// Method to check if poll is expired
pollSchema.methods.isExpired = function() {
  return new Date() > this.endDate;
};

// Method to get winning option(s)
pollSchema.methods.getWinningOptions = function() {
  if (this.options.length === 0) return [];
  
  const maxVotes = Math.max(...this.options.map(option => option.votes));
  return this.options
    .map((option, index) => ({ ...option.toObject(), index }))
    .filter(option => option.votes === maxVotes);
};

module.exports = mongoose.model('Poll', pollSchema); 