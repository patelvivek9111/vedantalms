const mongoose = require('mongoose');
const Submission = require('./models/Submission');

mongoose.connect('mongodb://localhost:27017/lms').then(async () => {
  try {
    console.log('Connected to MongoDB');
    
    // Find the submission to delete
    const submissionId = '6877a5b256bfb47a92861030'; // Replace with the actual submission ID
    const submission = await Submission.findById(submissionId);
    
    if (!submission) {
      console.log('Submission not found');
      return;
    }
    
    console.log('Found submission:', {
      id: submission._id,
      student: submission.student,
      assignment: submission.assignment,
      submittedAt: submission.submittedAt
    });
    
    // Delete the submission
    const result = await Submission.findByIdAndDelete(submissionId);
    
    if (result) {
      console.log('Successfully deleted submission');
    } else {
      console.log('Failed to delete submission');
    }
    
    // Verify deletion
    const deletedSubmission = await Submission.findById(submissionId);
    if (!deletedSubmission) {
      console.log('Verification: Submission successfully deleted from database');
    } else {
      console.log('Verification: Submission still exists in database');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}); 