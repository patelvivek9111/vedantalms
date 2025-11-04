const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Group = require('../models/Group');
const fs = require('fs').promises;
const path = require('path');
const Module = require('../models/module.model');

// Submit an assignment
exports.submitAssignment = async (req, res) => {
  try {
    const { submissionText, groupId } = req.body;
    const assignmentId = req.params.assignmentId;
    
    // Check if assignment exists
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check if due date has passed
    if (new Date() > assignment.dueDate) {
      return res.status(400).json({ message: 'Assignment due date has passed' });
    }

    let group = null;
    if (assignment.isGroupAssignment) {
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required for group assignments' });
      }

      // Verify the group exists and user is a member
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      if (!group.members.includes(req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this group' });
      }

      // Check if group belongs to the correct group set
      if (group.groupSet.toString() !== assignment.groupSet.toString()) {
        return res.status(400).json({ message: 'Group does not belong to the required group set' });
      }
    }
    
    // Check if submission already exists
    const query = assignment.isGroupAssignment
      ? { assignment: assignmentId, group: groupId }
      : { assignment: assignmentId, student: req.user._id };
    
    const existingSubmission = await Submission.findOne(query);
    
    if (existingSubmission) {
      // If there's an existing submission, delete its files
      if (existingSubmission.files.length > 0) {
        await Promise.all(existingSubmission.files.map(async (file) => {
          const filePath = path.join(__dirname, '..', file);
          try {
            await fs.unlink(filePath);
          } catch (err) {
            console.error('Error deleting file:', err);
          }
        }));
      }
      
      // Update existing submission
      existingSubmission.submissionText = submissionText;
      existingSubmission.files = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
      existingSubmission.submittedAt = new Date();
      existingSubmission.submittedBy = req.user._id;
      
      await existingSubmission.save();
      return res.json(existingSubmission);
    }
    
    // Get file URLs from uploaded files
    const files = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    const submission = new Submission({
      assignment: assignmentId,
      student: req.user._id,
      group: group ? group._id : undefined,
      submittedBy: req.user._id,
      submissionText,
      files
    });
    
    await submission.save();
    res.status(201).json(submission);
  } catch (error) {
    // If there's an error, delete any uploaded files
    if (req.files) {
      await Promise.all(req.files.map(file => 
        fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
      ));
    }
    res.status(500).json({ message: error.message });
  }
};

// Create a new submission (student only)
exports.createSubmission = async (req, res) => {
  try {

    const { assignment, answers, groupId } = req.body;
    
    // Check if user is a student
    if (req.user.role !== 'student') {

      return res.status(403).json({ message: 'Only students can submit assignments' });
    }

    // Check if assignment exists and is not past due
    const assignmentDoc = await Assignment.findById(assignment);
    if (!assignmentDoc) {
      
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (new Date() > new Date(assignmentDoc.dueDate)) {
      
      return res.status(400).json({ message: 'Assignment is past due' });
    }

    // Check if there are any answers provided
    const hasAnswers = answers && Object.keys(answers).length > 0;
    
    
    // For assignments with questions, require at least some answers
    if (assignmentDoc.questions && assignmentDoc.questions.length > 0) {
      const hasAnyAnswers = hasAnswers && Object.values(answers).some(answer => 
        answer && answer.toString().trim() !== ''
      );
      
      
      
      if (!hasAnyAnswers) {
        
        return res.status(400).json({ message: 'Please provide answers for the assignment questions' });
      }
    }

    let group = null;
    if (assignmentDoc.isGroupAssignment) {
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required for group assignments' });
      }

      // Verify the group exists and user is a member
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      if (!group.members.includes(req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this group' });
      }

      // Check if group belongs to the correct group set
      if (group.groupSet.toString() !== assignmentDoc.groupSet.toString()) {
        return res.status(400).json({ message: 'Group does not belong to the required group set' });
      }
    }

    // Check if submission already exists
    const query = assignmentDoc.isGroupAssignment
      ? { assignment, group: groupId }
      : { assignment, student: req.user._id };

    const existingSubmission = await Submission.findOne(query);
    
    if (existingSubmission) {
      // Update existing submission
      existingSubmission.answers = answers;
      existingSubmission.submittedAt = new Date();
      existingSubmission.submittedBy = req.user._id;
      existingSubmission.files = req.body.uploadedFiles || [];
      
      await existingSubmission.save();
      
      // Auto-grade multiple choice questions if they exist
      if (assignmentDoc.questions && assignmentDoc.questions.length > 0) {
        const autoGradeResult = await autoGradeSubmission(existingSubmission, assignmentDoc);
        
        // Update submission with auto-grade results
        existingSubmission.autoGraded = autoGradeResult.autoGraded;
        existingSubmission.autoGrade = autoGradeResult.autoGrade;
        existingSubmission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
        
        // If all questions are multiple choice, set final grade immediately
        if (autoGradeResult.allMultipleChoice) {
          existingSubmission.finalGrade = autoGradeResult.autoGrade; // This is now points
          existingSubmission.teacherApproved = true;
          existingSubmission.grade = autoGradeResult.autoGrade; // This is now points
          existingSubmission.gradedBy = req.user._id;
          existingSubmission.gradedAt = new Date();
        }
        
        await existingSubmission.save();
      }
      
      return res.status(200).json(existingSubmission);
    }

    // Create new submission
    const submission = new Submission({
      assignment,
      student: req.user._id,
      group: group ? group._id : undefined,
      submittedBy: req.user._id,
      answers,
      submittedAt: new Date(),
      files: req.body.uploadedFiles || []
    });

    

    await submission.save();
    


    // Auto-grade multiple choice questions if they exist
    if (assignmentDoc.questions && assignmentDoc.questions.length > 0) {
      const autoGradeResult = await autoGradeSubmission(submission, assignmentDoc);
      
      // Update submission with auto-grade results
      submission.autoGraded = autoGradeResult.autoGraded;
      submission.autoGrade = autoGradeResult.autoGrade;
      submission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
      
      // If all questions are multiple choice, set final grade immediately
      if (autoGradeResult.allMultipleChoice) {
        submission.finalGrade = autoGradeResult.autoGrade; // This is now points
        submission.teacherApproved = true;
        submission.grade = autoGradeResult.autoGrade; // This is now points
        submission.gradedBy = req.user._id;
        submission.gradedAt = new Date();
      }
      
      await submission.save();
    }

    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Auto-grade submission function
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
        
        // Calculate points based on percentage of correct matches
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

// Get submissions for an assignment
exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const submissions = await Submission.find({ assignment: req.params.assignmentId })
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'group',
        populate: {
          path: 'members',
          select: 'firstName lastName email'
        }
      })
      .populate('memberGrades.student', 'firstName lastName email')
      .populate('memberGrades.gradedBy', 'firstName lastName');

    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all submissions for a student in a course
exports.getStudentSubmissionsForCourse = async (req, res) => {
  try {
    // Find all modules in the course
    const modules = await Module.find({ course: req.params.courseId }).select('_id');
    const moduleIds = modules.map(m => m._id);
    // Find all assignments in those modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } }).select('_id');
    const assignmentIds = assignments.map(a => a._id);
    
    // Find all group assignments for the course
    const groupAssignmentsRaw = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    }).populate({ path: 'groupSet', match: { course: req.params.courseId } });
    // Only keep group assignments for this course
    const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);
    const groupAssignmentIds = groupAssignments.map(a => a._id);

    // Find all submissions by this student for regular assignments
    const individualSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: req.user._id
    }).populate('assignment');

    // For group assignments, find the student's group for each groupSet
    let groupSubmissions = [];
    for (const groupAssignment of groupAssignments) {
      // Find the student's group in this groupSet
      const group = await Group.findOne({
        groupSet: groupAssignment.groupSet._id,
        members: req.user._id
      });
      if (group) {
        // Find the submission for this group assignment and group
        const submission = await Submission.findOne({
          assignment: groupAssignment._id,
          group: group._id
        }).populate('assignment');
        if (submission) {
          groupSubmissions.push(submission);
        }
      }
    }

    // Combine and return all submissions
    const allSubmissions = [...individualSubmissions, ...groupSubmissions];
    res.json(allSubmissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Grade a submission
exports.gradeSubmission = async (req, res) => {
  try {
    const { grade, feedback, questionGrades, useIndividualGrades, memberGrades, approveGrade, showCorrectAnswers, showStudentAnswers } = req.body;
    const submission = await Submission.findById(req.params.id).populate('group');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Backwards compatibility: If submittedBy is missing, set it to the student
    if (!submission.submittedBy) {
      submission.submittedBy = submission.student;
    }

    // Handle auto-graded submissions (allow re-grading even if approved)
    if (submission.autoGraded) {
      if (approveGrade) {
        // Teacher is approving the auto-grade
        submission.teacherApproved = true;
        submission.gradedBy = req.user._id;
        submission.gradedAt = new Date();
        
        // Combine auto-graded question grades with teacher grades
        const combinedQuestionGrades = new Map();
        
        // Handle autoQuestionGrades whether it's a Map or object
        if (submission.autoQuestionGrades instanceof Map) {
          submission.autoQuestionGrades.forEach((value, key) => {
            combinedQuestionGrades.set(key, value);
          });
        } else if (submission.autoQuestionGrades && typeof submission.autoQuestionGrades === 'object') {
          Object.entries(submission.autoQuestionGrades).forEach(([key, value]) => {
            combinedQuestionGrades.set(key, value);
          });
        }
        
        // Include any teacher modifications to grades
        if (questionGrades) {
          Object.entries(questionGrades).forEach(([key, value]) => {
            combinedQuestionGrades.set(key, parseFloat(value) || 0);
          });
        }
        submission.questionGrades = combinedQuestionGrades;
        
        // Calculate final grade from combined question grades
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions) {
          let earnedPoints = 0;
          for (let i = 0; i < assignment.questions.length; i++) {
            const grade = combinedQuestionGrades.get(i.toString());
            if (grade !== undefined) {
              earnedPoints += grade;
            } else {
              // Fallback to auto-grade if not in combined grades
              let autoGrade = 0;
              if (submission.autoQuestionGrades instanceof Map) {
                autoGrade = submission.autoQuestionGrades.get(i.toString()) || 0;
              } else if (submission.autoQuestionGrades && typeof submission.autoQuestionGrades === 'object') {
                autoGrade = submission.autoQuestionGrades[i.toString()] || 0;
              }
              earnedPoints += autoGrade;
            }
          }
          submission.finalGrade = earnedPoints;
          submission.grade = submission.finalGrade;
        } else {
          // Fallback if assignment not found
          submission.finalGrade = submission.autoGrade;
          submission.grade = submission.autoGrade;
        }
      } else {
        // Teacher is providing manual grades for non-MC questions or re-grading
        // Always recalculate final grade combining auto-grade and manual grades
        // This ensures correct calculation even when re-grading existing submissions
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions) {
          let totalPoints = 0;
          let earnedPoints = 0;
          
          // Ensure autoQuestionGrades exists - if not, recalculate them
          // Convert to Map format if it's stored as an object
          let autoQuestionGradesMap = new Map();
          if (submission.autoQuestionGrades) {
            if (submission.autoQuestionGrades instanceof Map) {
              autoQuestionGradesMap = submission.autoQuestionGrades;
            } else if (typeof submission.autoQuestionGrades === 'object') {
              // Convert object to Map
              Object.entries(submission.autoQuestionGrades).forEach(([key, value]) => {
                autoQuestionGradesMap.set(key, value);
              });
            }
          }
          
          // Always recalculate auto-grades if we have an auto-graded submission but no auto-grades stored
          // This ensures we have the latest auto-grades even if they weren't saved properly
          if (submission.autoGraded && autoQuestionGradesMap.size === 0) {
            const autoGradeResult = await autoGradeSubmission(submission, assignment);
            submission.autoGraded = autoGradeResult.autoGraded;
            submission.autoGrade = autoGradeResult.autoGrade;
            submission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
            autoQuestionGradesMap = autoGradeResult.autoQuestionGrades;
          }
          
          // If we still don't have auto-grades for all questions, recalculate
          if (autoQuestionGradesMap.size < assignment.questions.length && submission.autoGraded) {
            const autoGradeResult = await autoGradeSubmission(submission, assignment);
            submission.autoGraded = autoGradeResult.autoGraded;
            submission.autoGrade = autoGradeResult.autoGrade;
            submission.autoQuestionGrades = autoGradeResult.autoQuestionGrades;
            autoQuestionGradesMap = autoGradeResult.autoQuestionGrades;
          }
          
          // Convert questionGrades to Map format if needed
          // Start fresh and build from teacher-provided grades + auto-grades
          // This ensures we always recalculate correctly, even when re-grading
          let questionGradesMap = new Map();
          
          // First, load teacher-provided grades from the request (highest priority)
          // These are the grades the teacher is submitting now
          if (questionGrades && typeof questionGrades === 'object') {
            Object.entries(questionGrades).forEach(([key, value]) => {
              const questionIndex = parseInt(key);
              if (questionIndex < assignment.questions.length) {
                const question = assignment.questions[questionIndex];
                const parsedValue = parseFloat(value);
                
                // Store teacher-provided grades for text questions
                if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                  questionGradesMap.set(key, isNaN(parsedValue) ? 0 : parsedValue);
                } else {
                  // For auto-graded questions, only store if teacher explicitly changed it
                  const autoGrade = autoQuestionGradesMap.get(key);
                  if (autoGrade !== undefined && autoGrade !== null && 
                      !isNaN(parsedValue) && Math.abs(parsedValue - autoGrade) > 0.01) {
                    // Teacher explicitly changed the auto-grade
                    questionGradesMap.set(key, parsedValue);
                  }
                }
              }
            });
          }
          
          // Load existing text question grades from submission for any questions not provided in request
          // This ensures we don't lose previously graded text questions when re-grading
          // IMPORTANT: Don't load auto-graded questions unless they were manually overridden
          if (submission.questionGrades) {
            if (submission.questionGrades instanceof Map) {
              submission.questionGrades.forEach((value, key) => {
                const questionIndex = parseInt(key);
                if (questionIndex < assignment.questions.length && !questionGradesMap.has(key)) {
                  const question = assignment.questions[questionIndex];
                  // Only preserve text questions (auto-graded questions will use auto-grade)
                  if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                    questionGradesMap.set(key, value);
                  } else {
                    // For auto-graded questions, only preserve if manually overridden
                    // Filter out incorrect stored data (0 when auto-grade is > 0)
                    const autoGrade = autoQuestionGradesMap.get(key);
                    if (autoGrade !== undefined && autoGrade !== null) {
                      const difference = Math.abs(value - autoGrade);
                      // Only preserve if significantly different AND not incorrect stored data
                      if (difference > 0.01 && !(value === 0 && autoGrade > 0)) {
                        // Teacher previously overrode this auto-grade, preserve it
                        questionGradesMap.set(key, value);
                      }
                    }
                  }
                }
              });
            } else if (typeof submission.questionGrades === 'object') {
              Object.entries(submission.questionGrades).forEach(([key, value]) => {
                const questionIndex = parseInt(key);
                if (questionIndex < assignment.questions.length && !questionGradesMap.has(key)) {
                  const question = assignment.questions[questionIndex];
                  // Only preserve text questions
                  if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                    questionGradesMap.set(key, value);
                  } else {
                    // For auto-graded questions, only preserve if manually overridden
                    // Filter out incorrect stored data (0 when auto-grade is > 0)
                    const autoGrade = autoQuestionGradesMap.get(key);
                    if (autoGrade !== undefined && autoGrade !== null) {
                      const difference = Math.abs(value - autoGrade);
                      // Only preserve if significantly different AND not incorrect stored data
                      if (difference > 0.01 && !(value === 0 && autoGrade > 0)) {
                        // Teacher previously overrode this auto-grade, preserve it
                        questionGradesMap.set(key, value);
                      }
                    }
                  }
                }
              });
            }
          }
          
          for (let i = 0; i < assignment.questions.length; i++) {
            const question = assignment.questions[i];
            totalPoints += question.points || 0;
            
            // Check if teacher has provided a grade for this question
            const teacherGrade = questionGradesMap.get(i.toString());
            
            let pointsToAdd = 0;
            if (teacherGrade !== undefined && teacherGrade !== null) {
              // Use teacher's grade if provided
              pointsToAdd = teacherGrade;
            } else if (question.type === 'multiple-choice' || question.type === 'matching') {
              // Use auto-grade for MC and matching questions if teacher hasn't provided a grade
              const autoGrade = autoQuestionGradesMap.get(i.toString());
              if (autoGrade !== undefined && autoGrade !== null) {
                pointsToAdd = autoGrade;
              } else {
                // If auto-grade not found, use 0
                pointsToAdd = 0;
              }
            } else {
              // Use 0 for non-MC/non-matching questions if teacher hasn't provided a grade
              pointsToAdd = 0;
            }
            
            // Store the final grade for this question (whether auto or manual)
            // This ensures questionGrades contains all grades for accurate recalculation
            questionGradesMap.set(i.toString(), pointsToAdd);
            
            earnedPoints += pointsToAdd;
          }
          
          submission.finalGrade = earnedPoints; // Store actual points earned, not percentage
          submission.grade = submission.finalGrade;
          submission.questionGrades = questionGradesMap; // Store as Map with all final grades
          submission.teacherApproved = true;
          submission.gradedBy = req.user._id;
          submission.gradedAt = new Date();
        }
      }
    } else {
      // Traditional grading for non-auto-graded submissions
      if (useIndividualGrades && submission.group) {
        submission.useIndividualGrades = true;
        submission.memberGrades = [];
        let totalGrade = 0;
        let membersGraded = 0;
        
        for (const memberId in memberGrades) {
          const memberGrade = parseFloat(memberGrades[memberId]);
          if (!isNaN(memberGrade)) {
            submission.memberGrades.push({
              student: memberId,
              grade: memberGrade,
              gradedBy: req.user._id,
              gradedAt: new Date(),
            });
            totalGrade += memberGrade;
            membersGraded++;
          }
        }
        // Calculate average grade for the group
        submission.grade = membersGraded > 0 ? totalGrade / membersGraded : 0;

      } else {
        submission.useIndividualGrades = false;
        // Only validate grade if it's provided and not approving auto-grade
        if (grade !== undefined && !approveGrade) {
          const parsedGrade = parseFloat(grade);
          if (isNaN(parsedGrade)) {
            return res.status(400).json({ message: 'Invalid grade format' });
          }
          submission.grade = parsedGrade;
        }
      }
      
      if (questionGrades) {
        submission.questionGrades = new Map(
          Object.entries(questionGrades).map(([key, value]) => [key, parseFloat(value) || 0])
        );
        
        // Recalculate final grade based on manual grades
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions) {
          let earnedPoints = 0;
          
          for (let i = 0; i < assignment.questions.length; i++) {
            const teacherGrade = submission.questionGrades.get(i.toString());
            if (teacherGrade !== undefined) {
              earnedPoints += teacherGrade;
            }
          }
          
          submission.finalGrade = earnedPoints;
          submission.grade = submission.finalGrade;
          submission.teacherApproved = true;
          submission.gradedBy = req.user._id;
          submission.gradedAt = new Date();
        }
      }
    }

    submission.feedback = feedback;
    
    // Update quiz feedback options if provided
    if (showCorrectAnswers !== undefined) {
      submission.showCorrectAnswers = showCorrectAnswers;
    }
    if (showStudentAnswers !== undefined) {
      submission.showStudentAnswers = showStudentAnswers;
    }
    
    await submission.save();
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'group',
        populate: {
          path: 'members',
          select: 'firstName lastName email'
        }
      })
      .populate('memberGrades.student', 'firstName lastName email')
      .populate('memberGrades.gradedBy', 'firstName lastName');

    res.json(populatedSubmission);
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get a student's submission for an assignment
exports.getStudentSubmission = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    let submission;
    
    if (assignment.isGroupAssignment) {
      // For group assignments, find the student's group and then the submission
      const group = await Group.findOne({
        groupSet: assignment.groupSet,
        members: req.user._id
      });
      
      if (!group) {
        return res.status(404).json({ message: 'You are not a member of any group for this assignment' });
      }
      
      submission = await Submission.findOne({
        assignment: req.params.assignmentId,
        group: group._id
      }).populate('assignment');
    } else {
      // For regular assignments, find submission by student
      submission = await Submission.findOne({
        assignment: req.params.assignmentId,
        student: req.user._id
      }).populate('assignment');
    }

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single submission
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'group',
        populate: {
          path: 'members',
          select: 'firstName lastName email'
        }
      })
      .populate('memberGrades.student', 'firstName lastName email')
      .populate('memberGrades.gradedBy', 'firstName lastName');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 

// Delete a submission
exports.deleteSubmission = async (req, res) => {
  try {
    
    const submission = await Submission.findById(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }



    // Check if user is authorized to delete this submission
    // Teachers and admins can delete any submission
    // Students can only delete their own submissions
    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    const isOwnSubmission = submission.student.toString() === req.user._id.toString();



    if (!isTeacher && !isOwnSubmission) {

      return res.status(403).json({ message: 'Not authorized to delete this submission' });
    }

    // Delete any uploaded files
    if (submission.files && submission.files.length > 0) {
      await Promise.all(submission.files.map(async (file) => {
        const filePath = path.join(__dirname, '..', file);
        try {
          await fs.unlink(filePath);

        } catch (err) {
          console.error('[DeleteSubmission] Error deleting file:', err);
        }
      }));
    }


    
    // Try using findByIdAndDelete instead of deleteOne
    const result = await Submission.findByIdAndDelete(submission._id);
    if (result) {
      res.json({ message: 'Submission deleted successfully' });
    } else {
      res.status(404).json({ message: 'Submission not found' });
    }
  } catch (error) {
    console.error('[DeleteSubmission] Error:', error);
    res.status(500).json({ message: error.message });
  }
}; 