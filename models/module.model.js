const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  pages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Page'
  }],
  published: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Pre-remove hook to clean up assignment references if assignments are deleted
moduleSchema.pre('remove', async function(next) {
  // Remove all assignments that reference this module
  const Assignment = require('./Assignment');
  await Assignment.deleteMany({ module: this._id });
  next();
});

// Static method to clean orphaned assignment references from all modules
moduleSchema.statics.cleanOrphanAssignments = async function() {
  const Assignment = require('./Assignment');
  const allAssignmentIds = new Set((await Assignment.find({}, '_id')).map(a => a._id.toString()));
  const modules = await this.find({});
  let totalOrphans = 0;
  let modulesUpdated = 0;
  for (const module of modules) {
    if (!Array.isArray(module.assignments)) continue;
    const originalAssignments = module.assignments.map(id => id.toString());
    const validAssignments = originalAssignments.filter(id => allAssignmentIds.has(id));
    const orphaned = originalAssignments.filter(id => !allAssignmentIds.has(id));
    if (orphaned.length > 0) {
      module.assignments = validAssignments;
      await module.save();
      modulesUpdated++;
      totalOrphans += orphaned.length;

    }
  }
  return { modulesUpdated, totalOrphans };
};

module.exports = mongoose.model('Module', moduleSchema); 