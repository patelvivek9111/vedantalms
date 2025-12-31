const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: false
  },
  groupSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupSet',
    required: false
  },
  content: {
    type: String,
    required: true
  },
  attachments: [{
    type: String // URL to file
  }],
  published: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Custom validation: at least one of module or groupSet must be present
pageSchema.pre('validate', function(next) {
  if (!this.module && !this.groupSet) {
    this.invalidate('module', 'Either module or groupSet is required');
    this.invalidate('groupSet', 'Either module or groupSet is required');
  }
  next();
});

module.exports = mongoose.model('Page', pageSchema); 