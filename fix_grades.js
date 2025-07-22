const mongoose = require('mongoose');
require('./models/Submission.js');
require('./models/Assignment.js');
require('./models/user.model.js');

const Submission = mongoose.model('Submission');
const Assignment = mongoose.model('Assignment');

async function fixGrades() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lms');
    console.log('Connected to MongoDB');

    // Find all submissions with auto-graded data
    const submissions = await Submission.find({
      autoGraded: true,
      autoQuestionGrades: { $exists: true, $ne: null }
    }).populate('assignment').populate('student');

    console.log(`Found ${submissions.length} auto-graded submissions`);

    for (const submission of submissions) {
      console.log(`\nChecking submission ${submission._id} for student ${submission.student?.firstName} ${submission.student?.lastName}`);
      
      if (!submission.assignment || !submission.assignment.questions) {
        console.log('  Skipping - no assignment or questions found');
        continue;
      }

      // Calculate the correct points earned
      let totalPoints = 0;
      let earnedPoints = 0;
      
      for (let i = 0; i < submission.assignment.questions.length; i++) {
        const question = submission.assignment.questions[i];
        totalPoints += question.points || 0;
        
        if (question.type === 'multiple-choice') {
          // Get the auto-grade for this question
          let autoGrade = 0;
          if (submission.autoQuestionGrades instanceof Map) {
            autoGrade = submission.autoQuestionGrades.get(i.toString()) || 0;
          } else if (submission.autoQuestionGrades && typeof submission.autoQuestionGrades === 'object') {
            autoGrade = submission.autoQuestionGrades[i.toString()] || 0;
          }
          earnedPoints += autoGrade;
        }
      }

      console.log(`  Total possible points: ${totalPoints}`);
      console.log(`  Correct earned points: ${earnedPoints}`);
      console.log(`  Current autoGrade: ${submission.autoGrade}`);
      console.log(`  Current finalGrade: ${submission.finalGrade}`);
      console.log(`  Current grade: ${submission.grade}`);

      // Check if the grades are incorrect (stored as percentage instead of points)
      const expectedPercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      
      if (submission.autoGrade === expectedPercentage && submission.autoGrade !== earnedPoints) {
        console.log(`  FIXING: autoGrade is stored as percentage (${submission.autoGrade}%) instead of points (${earnedPoints})`);
        submission.autoGrade = earnedPoints;
      }
      
      if (submission.finalGrade === expectedPercentage && submission.finalGrade !== earnedPoints) {
        console.log(`  FIXING: finalGrade is stored as percentage (${submission.finalGrade}%) instead of points (${earnedPoints})`);
        submission.finalGrade = earnedPoints;
      }
      
      if (submission.grade === expectedPercentage && submission.grade !== earnedPoints) {
        console.log(`  FIXING: grade is stored as percentage (${submission.grade}%) instead of points (${earnedPoints})`);
        submission.grade = earnedPoints;
      }

      await submission.save();
      console.log(`  Updated submission`);
    }

    console.log('\nGrade fixing completed!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

fixGrades(); 