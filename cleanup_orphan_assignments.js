// cleanup_orphan_assignments.js
// Run this script with: node cleanup_orphan_assignments.js

const mongoose = require('mongoose');

// TODO: Update this with your actual MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/lms';

const Assignment = require('./models/Assignment');
const Module = require('./models/module.model');

async function cleanupOrphanAssignments() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const allAssignmentIds = new Set((await Assignment.find({}, '_id')).map(a => a._id.toString()));
  const modules = await Module.find({});
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
      console.log(`Module ${module._id}: removed orphaned assignments:`, orphaned);
    }
  }

  console.log(`\nCleanup complete. Updated ${modulesUpdated} modules. Removed ${totalOrphans} orphaned assignment references.`);
  await mongoose.disconnect();
}

cleanupOrphanAssignments().catch(err => {
  console.error('Error during cleanup:', err);
  mongoose.disconnect();
}); 