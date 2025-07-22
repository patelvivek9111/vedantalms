const mongoose = require('mongoose');
require('./models/user.model'); // Load User model first
const Submission = require('./models/Submission');
const Assignment = require('./models/Assignment');

// Auto-grade submission function (copied from submission.controller.js with the fix)
const autoGradeSubmission = async (submission, assignment) => {
  let totalPoints = 0;
  let earnedPoints = 0;
  let autoQuestionGrades = new Map();
  let allMultipleChoice = true;
  let hasMultipleChoice = false;

  for (let i = 0; i < assignment.questions.length; i++) {
    const question = assignment.questions[i];
    
    // Handle answers whether it's a Map or object
    let studentAnswer = '';
    if (submission.answers instanceof Map) {
      studentAnswer = submission.answers.get(i.toString()) || '';
    } else if (submission.answers && typeof submission.answers === 'object') {
      studentAnswer = submission.answers[i.toString()] || '';
    }
    
    totalPoints += question.points || 0;
    
    if (question.type === 'multiple-choice') {
      hasMultipleChoice = true;
      
      // Check if student answer matches correct answer
      const correctAnswer = question.options?.find(option => option.isCorrect)?.text;
      if (studentAnswer === correctAnswer) {
        earnedPoints += question.points || 0;
        autoQuestionGrades.set(i.toString(), question.points || 0);
      } else {
        autoQuestionGrades.set(i.toString(), 0);
      }
    } else if (question.type === 'matching') {
      hasMultipleChoice = true;
      
      // Handle matching questions
      let questionPoints = 0;
      let totalMatches = 0;
      let correctMatches = 0;
      
      // Parse student answer if it's a JSON string
      let parsedStudentAnswer = studentAnswer;
      if (typeof studentAnswer === 'string') {
        try {
          parsedStudentAnswer = JSON.parse(studentAnswer);
        } catch (e) {
          parsedStudentAnswer = {};
        }
      }
      
      if (question.leftItems && question.rightItems && parsedStudentAnswer && typeof parsedStudentAnswer === 'object') {
        totalMatches = question.leftItems.length;
        
        for (let j = 0; j < question.leftItems.length; j++) {
          const leftItem = question.leftItems[j];
          const studentMatch = parsedStudentAnswer[j];
          
          // Find the correct match for this left item
          const correctRightItem = question.rightItems.find(rightItem => 
            rightItem.id === leftItem.id
          );
          
          if (correctRightItem && studentMatch === correctRightItem.text) {
            correctMatches++;
          }
        }
        
        // Calculate points based on percentage of correct matches (FIXED VERSION)
        if (totalMatches > 0) {
          const percentageCorrect = correctMatches / totalMatches;
          questionPoints = Math.floor((question.points || 0) * percentageCorrect * 100) / 100;
        }
      }
      
      earnedPoints += questionPoints;
      autoQuestionGrades.set(i.toString(), questionPoints);
    } else {
      // Non-multiple choice questions need teacher grading
      allMultipleChoice = false;
      autoQuestionGrades.set(i.toString(), 0);
    }
  }

  const autoGradePercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  
  return {
    autoGraded: hasMultipleChoice,
    autoGrade: earnedPoints, // Store actual points earned, not percentage
    autoGradePercentage, // Store percentage separately if needed
    autoQuestionGrades,
    allMultipleChoice: allMultipleChoice && hasMultipleChoice
  };
};

async function fixMatchingGrades() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lms');
    console.log('Connected to MongoDB');

    // Find all submissions with auto-graded data that have matching questions
    const submissions = await Submission.find({
      autoGraded: true,
      autoQuestionGrades: { $exists: true, $ne: null }
    }).populate('assignment').populate('student');

    console.log(`Found ${submissions.length} auto-graded submissions`);

    let fixedCount = 0;

    for (const submission of submissions) {
      console.log(`\nChecking submission ${submission._id} for student ${submission.student?.firstName} ${submission.student?.lastName}`);
      
      if (!submission.assignment || !submission.assignment.questions) {
        console.log('  Skipping - no assignment or questions found');
        continue;
      }

      // Check if this assignment has matching questions
      const hasMatchingQuestions = submission.assignment.questions.some(q => q.type === 'matching');
      if (!hasMatchingQuestions) {
        console.log('  Skipping - no matching questions in this assignment');
        continue;
      }

      // Re-calculate grades using the fixed logic
      const autoGradeResult = await autoGradeSubmission(submission, submission.assignment);
      
      // Check if the grades need to be updated
      const oldAutoGrade = submission.autoGrade;
      const newAutoGrade = autoGradeResult.autoGrade;
      
      if (Math.abs(oldAutoGrade - newAutoGrade) > 0.01) {
        console.log(`  FIXING: autoGrade changed from ${oldAutoGrade} to ${newAutoGrade}`);
        
        // Update the submission with new grades
        submission.autoGrade = newAutoGrade;
        submission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
        
        // Update final grade and grade if they were auto-approved
        if (submission.teacherApproved && submission.finalGrade === oldAutoGrade) {
          submission.finalGrade = newAutoGrade;
          submission.grade = newAutoGrade;
        }
        
        await submission.save();
        fixedCount++;
        console.log(`  Updated submission`);
      } else {
        console.log(`  No change needed - autoGrade is already correct: ${oldAutoGrade}`);
      }
    }

    console.log(`\nGrade fixing completed! Fixed ${fixedCount} submissions.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

fixMatchingGrades(); 