const mongoose = require('mongoose');
const Submission = require('./models/Submission');
const User = require('./models/user.model');
const Assignment = require('./models/Assignment');

mongoose.connect('mongodb://localhost:27017/lms').then(async () => {
  try {
    const submissions = await Submission.find({})
      .populate('student', 'firstName lastName email')
      .populate('assignment', 'title')
      .populate('submittedBy', 'firstName lastName email');
    
    console.log('All submissions:');
    submissions.forEach(s => {
      console.log(`Assignment: ${s.assignment?.title}`);
      console.log(`Student: ${s.student?.firstName} ${s.student?.lastName} (${s.student?.email})`);
      console.log(`Submitted By: ${s.submittedBy?.firstName} ${s.submittedBy?.lastName} (${s.submittedBy?.email})`);
      console.log(`Submitted At: ${s.submittedAt}`);
      console.log(`Grade: ${s.grade}`);
      console.log('---');
    });
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}); 