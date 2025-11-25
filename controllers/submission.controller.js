const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Group = require('../models/Group');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Module = require('../models/module.model');
const archiver = require('archiver');
const { deleteFromCloudinary, extractPublicId, isCloudinaryConfigured, uploadToCloudinary } = require('../utils/cloudinary');

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

    // Check if assignment is available yet
    const now = new Date();
    if (assignmentDoc.availableFrom && new Date(assignmentDoc.availableFrom) > now) {
      return res.status(400).json({ message: 'Assignment is not available yet' });
    }

    // Check if assignment is past due (with a small buffer for timezone issues)
    if (assignmentDoc.dueDate && new Date(assignmentDoc.dueDate) < now) {
      return res.status(400).json({ message: 'Assignment is past due' });
    }

    // Check if there are any answers provided
    const hasAnswers = answers && Object.keys(answers).length > 0;
    
    // Check if files are provided
    const hasFiles = req.body.uploadedFiles && (
      (Array.isArray(req.body.uploadedFiles) && req.body.uploadedFiles.length > 0) ||
      (typeof req.body.uploadedFiles === 'string' && req.body.uploadedFiles.trim() !== '')
    );
    
    // For assignments with questions, require at least some answers
    // For file-upload-only assignments (allowStudentUploads with no questions), require files
    if (assignmentDoc.questions && assignmentDoc.questions.length > 0) {
      const hasAnyAnswers = hasAnswers && Object.values(answers).some(answer => 
        answer && answer.toString().trim() !== ''
      );
      
      if (!hasAnyAnswers) {
        return res.status(400).json({ message: 'Please provide answers for the assignment questions' });
      }
    } else if (assignmentDoc.allowStudentUploads && (!hasFiles || (Array.isArray(req.body.uploadedFiles) && req.body.uploadedFiles.length === 0))) {
      // File-upload-only assignment requires at least one file
      return res.status(400).json({ message: 'Please upload at least one file for this assignment' });
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
      // Store files as objects with url and originalname, or as strings for backward compatibility
      let filesArray = [];
      if (req.body.uploadedFiles) {
        if (Array.isArray(req.body.uploadedFiles)) {
          filesArray = req.body.uploadedFiles.map(file => {
            // If it's an object with url and name, store the object
            if (typeof file === 'object' && file.url) {
              return {
                url: file.url,
                name: file.name || file.originalname || file.url.split('/').pop(),
                originalname: file.name || file.originalname || file.url.split('/').pop()
              };
            }
            // If it's already a string, keep it as string for backward compatibility
            return typeof file === 'string' ? file : String(file);
          });
        } else if (typeof req.body.uploadedFiles === 'string') {
          filesArray = [req.body.uploadedFiles];
        }
      }
      
      existingSubmission.answers = answers;
      existingSubmission.submittedAt = new Date();
      existingSubmission.submittedBy = req.user._id;
      existingSubmission.files = filesArray;
      
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
    // Ensure files is an array of strings (file paths/URLs)
    let filesArray = [];
    if (req.body.uploadedFiles) {
      if (Array.isArray(req.body.uploadedFiles)) {
        filesArray = req.body.uploadedFiles.map(file => {
          // If it's an object with url property, extract the URL
          if (typeof file === 'object' && file.url) {
            return file.url;
          }
          // If it's already a string, use it directly
          return typeof file === 'string' ? file : String(file);
        });
      } else if (typeof req.body.uploadedFiles === 'string') {
        filesArray = [req.body.uploadedFiles];
      }
    }
    
    
    const submission = new Submission({
      assignment,
      student: req.user._id,
      group: group ? group._id : undefined,
      submittedBy: req.user._id,
      answers,
      submittedAt: new Date(),
      files: filesArray
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
    let { grade, feedback, questionGrades, useIndividualGrades, memberGrades, approveGrade, showCorrectAnswers, showStudentAnswers, studentId } = req.body;
    
    // Parse questionGrades if it's a JSON string (from FormData)
    if (typeof questionGrades === 'string' && questionGrades.trim().startsWith('{')) {
      try {
        questionGrades = JSON.parse(questionGrades);
      } catch (e) {
        console.error('Error parsing questionGrades JSON:', e);
        questionGrades = {};
      }
    }
    
    // Parse approveGrade if it's a string (from FormData)
    if (typeof approveGrade === 'string') {
      approveGrade = approveGrade === 'true';
    }
    
    // Parse grade if it's a string (from FormData)
    // FormData always sends values as strings, so we need to parse them
    if (typeof grade === 'string') {
      if (grade.trim() === '' || grade === 'null' || grade === 'undefined') {
        grade = undefined;
      } else {
        const parsedGrade = parseFloat(grade);
        if (!isNaN(parsedGrade) && isFinite(parsedGrade)) {
          grade = parsedGrade;
        } else {
          grade = undefined;
        }
      }
    }
    
    let submission = await Submission.findById(req.params.id).populate('group');

    // If submission doesn't exist, check if this is for an offline assignment
    if (!submission) {
      // Try to find submission by assignment and student if studentId is provided
      if (studentId) {
        submission = await Submission.findOne({
          assignment: req.body.assignmentId || req.params.assignmentId,
          student: studentId
        }).populate('group');
      }
      
      // If still no submission and we have assignmentId and studentId, check if assignment is offline
      if (!submission && req.body.assignmentId && studentId) {
        const assignment = await Assignment.findById(req.body.assignmentId);
        if (assignment && assignment.isOfflineAssignment) {
          // Create a manual grade submission for offline assignment
          submission = new Submission({
            assignment: req.body.assignmentId,
            student: studentId,
            submittedBy: req.user._id, // Teacher is creating this
            isManualGrade: true,
            submittedAt: new Date()
          });
          await submission.save();
        } else {
      return res.status(404).json({ message: 'Submission not found' });
        }
      } else if (!submission) {
        return res.status(404).json({ message: 'Submission not found' });
      }
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
        if (grade !== undefined && grade !== null && !approveGrade) {
          // Grade should already be parsed as a number from FormData handling above
          const parsedGrade = typeof grade === 'number' ? grade : parseFloat(grade);
          if (isNaN(parsedGrade)) {
            return res.status(400).json({ message: 'Invalid grade format' });
          }
          submission.grade = parsedGrade;
          submission.finalGrade = parsedGrade; // Set finalGrade for upload-only assignments
          submission.teacherApproved = true;
          submission.gradedBy = req.user._id;
          submission.gradedAt = new Date();
        }
      }
      
      if (questionGrades && Object.keys(questionGrades).length > 0) {
        submission.questionGrades = new Map(
          Object.entries(questionGrades).map(([key, value]) => [key, parseFloat(value) || 0])
        );
        
        // Recalculate final grade based on manual grades
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && assignment.questions && assignment.questions.length > 0) {
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
    
    // Handle teacher feedback file uploads
    if (req.files && req.files.length > 0) {
      try {
        const feedbackFiles = [];
        
        // Process each uploaded file
        for (const file of req.files) {
          if (isCloudinaryConfigured()) {
            // Upload to Cloudinary
            const uploadResult = await uploadToCloudinary(file, {
              folder: 'lms/teacher-feedback',
              resource_type: 'auto' // Auto-detect file type
            });
            
            feedbackFiles.push({
              url: uploadResult.url,
              name: file.originalname,
              originalname: file.originalname
            });
          } else {
            // Store local file path
            const fileUrl = file.path.replace(/\\/g, '/'); // Normalize path separators
            feedbackFiles.push({
              url: fileUrl,
              name: file.originalname,
              originalname: file.originalname
            });
          }
        }
        
        // Add new files to existing teacher feedback files
        if (!submission.teacherFeedbackFiles) {
          submission.teacherFeedbackFiles = [];
        }
        submission.teacherFeedbackFiles = [...submission.teacherFeedbackFiles, ...feedbackFiles];
      } catch (error) {
        console.error('Error uploading teacher feedback files:', error);
        // Don't fail the entire request if file upload fails
        // Just log the error and continue
      }
    }
    
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

// Create or update a manual grade for an offline assignment
exports.createOrUpdateManualGrade = async (req, res) => {
  try {
    const { assignmentId, studentId, grade, feedback } = req.body;
    
    if (!assignmentId || !studentId) {
      return res.status(400).json({ message: 'Assignment ID and Student ID are required' });
    }
    
    // Verify assignment exists and is offline
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    if (!assignment.isOfflineAssignment) {
      return res.status(400).json({ message: 'This endpoint is only for offline assignments' });
    }
    
    // Check if submission already exists
    let submission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId
    });
    
    if (!submission) {
      // Create new manual grade submission
      submission = new Submission({
        assignment: assignmentId,
        student: studentId,
        submittedBy: req.user._id, // Teacher is creating this
        isManualGrade: true,
        submittedAt: new Date()
      });
    }
    
    // Update grade if provided
    if (grade !== undefined && grade !== null) {
      const gradeNum = parseFloat(grade);
      if (isNaN(gradeNum) || gradeNum < 0) {
        return res.status(400).json({ message: 'Invalid grade format' });
      }
      
      // Validate grade doesn't exceed max points
      const maxPoints = assignment.questions && assignment.questions.length > 0
        ? assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        : assignment.totalPoints || 0;
      
      if (gradeNum > maxPoints) {
        return res.status(400).json({ message: `Grade cannot exceed ${maxPoints} points` });
      }
      
      submission.grade = gradeNum;
      submission.gradedBy = req.user._id;
      submission.gradedAt = new Date();
    } else if (grade === null) {
      // Remove grade
      submission.grade = undefined;
    }
    
    if (feedback !== undefined) {
      submission.feedback = feedback;
    }
    
    await submission.save();
    
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('student', 'firstName lastName email')
      .populate('submittedBy', 'firstName lastName email')
      .populate('gradedBy', 'firstName lastName');
    
    res.json(populatedSubmission);
  } catch (error) {
    console.error('Error creating/updating manual grade:', error);
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
        // Extract file URL from object or string
        let fileUrl;
        if (typeof file === 'object' && file.url) {
          fileUrl = file.url;
        } else if (typeof file === 'string') {
          fileUrl = file;
        } else {
          fileUrl = String(file);
        }
        
        // Check if it's a Cloudinary URL
        if (fileUrl.includes('cloudinary.com') && isCloudinaryConfigured()) {
          const publicId = extractPublicId(fileUrl);
          if (publicId) {
            try {
              let resourceType = 'auto';
              if (fileUrl.includes('/raw/upload/')) {
                resourceType = 'raw';
              } else if (fileUrl.includes('/video/upload/')) {
                resourceType = 'video';
              } else if (fileUrl.includes('/image/upload/')) {
                resourceType = 'image';
              }
              await deleteFromCloudinary(publicId, resourceType);
            } catch (err) {
              console.error('[DeleteSubmission] Error deleting from Cloudinary:', err);
            }
          }
        } else {
          // Delete local file
          const filePath = path.join(__dirname, '..', fileUrl);
          try {
            await fs.unlink(filePath);
          } catch (err) {
            console.error('[DeleteSubmission] Error deleting file:', err);
          }
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

// Download all submissions for an assignment as a zip file
exports.downloadSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    // Get assignment details
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Get all submissions for this assignment
    const submissions = await Submission.find({ assignment: assignmentId })
      .populate('student', 'firstName lastName email');

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'No submissions found for this assignment' });
    }

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Set response headers
    res.attachment(`${assignment.title.replace(/[^a-z0-9]/gi, '_')}_submissions.zip`);
    archive.pipe(res);

    // Add files from each submission
    for (const submission of submissions) {
      const studentName = `${submission.student?.firstName || 'Unknown'}_${submission.student?.lastName || 'Student'}`.replace(/[^a-z0-9]/gi, '_');
      const studentFolder = `${studentName}_${submission.student?._id || submission._id}`;

      if (submission.files && submission.files.length > 0) {
        for (let i = 0; i < submission.files.length; i++) {
          const fileData = submission.files[i];
          
          // Extract file URL and original filename
          let fileUrl;
          let fileName;
          
          if (typeof fileData === 'object' && fileData.url) {
            // New format: object with url and originalname
            fileUrl = fileData.url;
            fileName = fileData.originalname || fileData.name || fileUrl.split('/').pop() || `file_${i + 1}`;
          } else if (typeof fileData === 'string') {
            // Legacy format: just a URL string
            fileUrl = fileData;
            fileName = fileUrl.split('/').pop() || `file_${i + 1}`;
          } else {
            fileUrl = String(fileData);
            fileName = fileUrl.split('/').pop() || `file_${i + 1}`;
          }
          
          // Ensure fileName has an extension
          if (!fileName.includes('.')) {
            const urlExt = fileUrl.split('.').pop()?.split('?')[0] || '';
            if (urlExt && urlExt.length <= 5) {
              fileName = `${fileName}.${urlExt}`;
            }
          }
          
          // Create unique filename if multiple files from same student
          const fileExtension = path.extname(fileName);
          const baseName = path.basename(fileName, fileExtension);
          const uniqueFileName = submission.files.length > 1 
            ? `${baseName}_${i + 1}${fileExtension}`
            : fileName;
          
          // Check if it's a Cloudinary URL
          if (fileUrl.includes('cloudinary.com')) {
            // Fetch from Cloudinary
            try {
              const https = require('https');
              const http = require('http');
              let fetchUrl = fileUrl;
              if (fileUrl.includes('/image/upload/') && (fileUrl.includes('.pdf') || fileUrl.includes('.doc') || fileUrl.includes('.docx'))) {
                fetchUrl = fileUrl.replace('/image/upload/', '/raw/upload/');
              }
              const protocol = fetchUrl.startsWith('https') ? https : http;
              
              await new Promise((resolve, reject) => {
                protocol.get(fetchUrl, (response) => {
                  if (response.statusCode === 200) {
                    archive.append(response, { name: `${studentFolder}/${uniqueFileName}` });
                    resolve();
                  } else if (response.statusCode === 301 || response.statusCode === 302) {
                    // Handle redirects
                    const redirectUrl = response.headers.location;
                    const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                    redirectProtocol.get(redirectUrl, (redirectResponse) => {
                      if (redirectResponse.statusCode === 200) {
                        archive.append(redirectResponse, { name: `${studentFolder}/${uniqueFileName}` });
                        resolve();
                      } else {
                        reject(new Error(`Failed to fetch file: ${redirectResponse.statusCode}`));
                      }
                    }).on('error', reject);
                  } else {
                    reject(new Error(`Failed to fetch file: ${response.statusCode}`));
                  }
                }).on('error', reject);
              });
            } catch (err) {
              console.error('[DownloadSubmissions] Error fetching Cloudinary file:', err);
            }
          } else {
            // For local files
            const fullPath = path.join(__dirname, '..', fileUrl);
            
            if (fsSync.existsSync(fullPath)) {
              archive.file(fullPath, { name: `${studentFolder}/${uniqueFileName}` });
            }
          }
        }
      }

      // Also add submission text if available
      if (submission.submissionText) {
        const textFileName = `submission_text_${submission._id}.txt`;
        archive.append(submission.submissionText, { name: `${studentFolder}/${textFileName}` });
      }
    }

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('[DownloadSubmissions] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

// Download a single submission (files directly, not zipped)
exports.downloadSingleSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    // Get submission details
    const submission = await Submission.findById(submissionId)
      .populate('student', 'firstName lastName email')
      .populate('assignment', 'title');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check authorization - teacher/admin or the student themselves
    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    const isOwnSubmission = submission.student && submission.student._id.toString() === req.user._id.toString();
    
    if (!isTeacher && !isOwnSubmission) {
      return res.status(403).json({ message: 'Not authorized to download this submission' });
    }

    // Only download if there are uploaded files
    if (!submission.files || submission.files.length === 0) {
      return res.status(404).json({ message: 'No files uploaded for this submission' });
    }

    // If only one file, download it directly
    if (submission.files.length === 1) {
      const fileData = submission.files[0];
      
      // Extract file URL and original filename
      let fileUrl;
      let fileName;
      
      if (typeof fileData === 'object' && fileData.url) {
        // New format: object with url and originalname
        fileUrl = fileData.url;
        // Prefer originalname, then name, then extract from URL
        fileName = fileData.originalname || fileData.name || '';
        
        // If we don't have a filename with extension, try to extract from URL
        if (!fileName || !fileName.includes('.')) {
          const urlFileName = fileUrl.split('/').pop() || '';
          // Remove query parameters and fragments from URL filename
          const cleanUrlFileName = urlFileName.split('?')[0].split('#')[0];
          
          // If URL filename has extension, use it
          if (cleanUrlFileName.includes('.')) {
            fileName = fileName ? `${fileName}.${cleanUrlFileName.split('.').pop()}` : cleanUrlFileName;
          } else if (fileName) {
            // We have a filename but no extension, try to get from URL path
            const urlWithoutQuery = fileUrl.split('?')[0];
            const urlParts = urlWithoutQuery.split('.');
            if (urlParts.length > 1) {
              const urlExt = urlParts[urlParts.length - 1].toLowerCase();
              if (urlExt && urlExt.length >= 2 && urlExt.length <= 5 && /^[a-z0-9]+$/.test(urlExt)) {
                fileName = `${fileName}.${urlExt}`;
              }
            }
          } else {
            fileName = cleanUrlFileName || 'download';
          }
        }
      } else if (typeof fileData === 'string') {
        // Legacy format: just a URL string
        fileUrl = fileData;
        const urlParts = fileUrl.split('/');
        fileName = urlParts[urlParts.length - 1] || 'download';
        // Remove query parameters
        fileName = fileName.split('?')[0].split('#')[0];
      } else {
        fileUrl = String(fileData);
        fileName = fileUrl.split('/').pop() || 'download';
        fileName = fileName.split('?')[0].split('#')[0];
      }
      
      // Ensure fileName has an extension - extract from URL if still missing
      if (!fileName.includes('.')) {
        // Try to extract extension from URL (before query parameters)
        const urlWithoutQuery = fileUrl.split('?')[0];
        const urlParts = urlWithoutQuery.split('.');
        if (urlParts.length > 1) {
          const urlExt = urlParts[urlParts.length - 1].toLowerCase();
          // Only use extension if it's a valid file extension (2-5 chars, alphanumeric)
          if (urlExt && urlExt.length >= 2 && urlExt.length <= 5 && /^[a-z0-9]+$/.test(urlExt)) {
            fileName = `${fileName}.${urlExt}`;
          } else {
            // Try to get extension from Cloudinary format parameter
            const formatMatch = fileUrl.match(/[?&]f=([a-z0-9]+)/i);
            if (formatMatch) {
              fileName = `${fileName}.${formatMatch[1]}`;
            } else {
              fileName = `${fileName}.pdf`; // Default fallback
            }
          }
        } else {
          fileName = `${fileName}.pdf`; // Default fallback
        }
      }
      
      // Final cleanup - ensure no query parameters or fragments in filename
      fileName = fileName.split('?')[0].split('#')[0];
      
      // Extract file extension
      const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
      
      // Format filename as: AssignmentName_FirstName_LastName.extension
      const assignmentName = submission.assignment?.title 
        ? submission.assignment.title.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
        : 'Assignment';
      const firstName = submission.student?.firstName 
        ? submission.student.firstName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
        : 'Student';
      const lastName = submission.student?.lastName 
        ? submission.student.lastName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
        : '';
      
      // Create formatted filename
      const formattedFileName = lastName 
        ? `${assignmentName}_${firstName}_${lastName}.${fileExtension}`
        : `${assignmentName}_${firstName}.${fileExtension}`;
      
      fileName = formattedFileName;
      
      // Helper function to get MIME type from extension
      const getMimeType = (filename) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const mimeTypes = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'txt': 'text/plain',
          'rtf': 'application/rtf',
          'odt': 'application/vnd.oasis.opendocument.text',
          'ods': 'application/vnd.oasis.opendocument.spreadsheet',
          'odp': 'application/vnd.oasis.opendocument.presentation',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'zip': 'application/zip',
          'rar': 'application/x-rar-compressed'
        };
        return mimeTypes[ext] || 'application/octet-stream';
      };
      
      // Check if it's a Cloudinary URL
      if (fileUrl.includes('cloudinary.com')) {
        // For Cloudinary URLs, fetch the file and serve it through our server
        try {
          const https = require('https');
          const http = require('http');
          
          // Fetch file from Cloudinary
          const protocol = fileUrl.startsWith('https') ? https : http;
          
          // Add a small delay to ensure Cloudinary has processed the file
          const fetchFile = () => {
            protocol.get(fileUrl, (cloudinaryResponse) => {
              if (cloudinaryResponse.statusCode === 200) {
                // Set headers for file download
                // Use MIME type from extension as primary, fallback to Cloudinary's content-type
                const contentTypeFromExt = getMimeType(fileName);
                const contentType = contentTypeFromExt !== 'application/octet-stream' 
                  ? contentTypeFromExt 
                  : (cloudinaryResponse.headers['content-type'] || 'application/octet-stream');
                
                // Properly encode filename for Content-Disposition header
                const encodedFileName = encodeURIComponent(fileName);
                
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`);
                if (cloudinaryResponse.headers['content-length']) {
                  res.setHeader('Content-Length', cloudinaryResponse.headers['content-length']);
                }
                
                // Pipe the response to the client
                cloudinaryResponse.pipe(res);
              } else if (cloudinaryResponse.statusCode === 301 || cloudinaryResponse.statusCode === 302) {
                // Handle redirects
                const redirectUrl = cloudinaryResponse.headers.location;
                
                // Follow the redirect
                const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                redirectProtocol.get(redirectUrl, (redirectResponse) => {
                  if (redirectResponse.statusCode === 200) {
                    // Use MIME type from extension as primary, fallback to redirect response's content-type
                    const contentTypeFromExt = getMimeType(fileName);
                    const contentType = contentTypeFromExt !== 'application/octet-stream' 
                      ? contentTypeFromExt 
                      : (redirectResponse.headers['content-type'] || 'application/octet-stream');
                    
                    // Properly encode filename for Content-Disposition header
                    const encodedFileName = encodeURIComponent(fileName);
                    
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`);
                    if (redirectResponse.headers['content-length']) {
                      res.setHeader('Content-Length', redirectResponse.headers['content-length']);
                    }
                    redirectResponse.pipe(res);
                  } else {
                    res.status(redirectResponse.statusCode).json({ message: 'Failed to fetch file from Cloudinary' });
                  }
                }).on('error', (err) => {
                  console.error('[DownloadSingleSubmission] Error fetching from redirect:', err);
                  res.status(500).json({ message: 'Error fetching file from Cloudinary' });
                });
              } else {
                res.status(cloudinaryResponse.statusCode).json({ 
                  message: 'Failed to fetch file from Cloudinary',
                  statusCode: cloudinaryResponse.statusCode
                });
              }
            }).on('error', (err) => {
              console.error('[DownloadSingleSubmission] Error fetching from Cloudinary:', err);
              res.status(500).json({ message: 'Error fetching file from Cloudinary: ' + err.message });
            });
          };
          
          // Small delay to ensure file is ready (Cloudinary sometimes needs a moment)
          setTimeout(fetchFile, 100);
          
          return;
        } catch (err) {
          console.error('[DownloadSingleSubmission] Error processing Cloudinary URL:', err);
          res.status(500).json({ message: 'Error processing file URL: ' + err.message });
          return;
        }
      }
      
      // For local files
      const fullPath = path.join(__dirname, '..', fileUrl);
      
      if (fsSync.existsSync(fullPath)) {
        // Set proper Content-Type for local files
        const contentTypeFromExt = getMimeType(fileName);
        if (contentTypeFromExt !== 'application/octet-stream') {
          res.setHeader('Content-Type', contentTypeFromExt);
        }
        res.download(fullPath, fileName);
        return;
      } else {
        // If it's a valid URL, redirect to it
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          res.redirect(fileUrl);
          return;
        }
        return res.status(404).json({ message: 'File not found on server' });
      }
    }

    // If multiple files, create a zip
    if (submission.files.length > 1) {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      // Format names consistently
      const assignmentName = submission.assignment?.title 
        ? submission.assignment.title.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
        : 'Assignment';
      const firstName = submission.student?.firstName 
        ? submission.student.firstName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
        : 'Student';
      const lastName = submission.student?.lastName 
        ? submission.student.lastName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_')
        : '';
      
      const studentName = lastName ? `${firstName}_${lastName}` : firstName;
      const zipFileName = lastName 
        ? `${assignmentName}_${firstName}_${lastName}.zip`
        : `${assignmentName}_${firstName}.zip`;

      res.attachment(zipFileName);
      archive.pipe(res);

      let filesAdded = 0;
      // Add files
      for (let i = 0; i < submission.files.length; i++) {
        const fileData = submission.files[i];
        
        // Extract file URL and original filename
        let fileUrl;
        let fileName;
        
        if (typeof fileData === 'object' && fileData.url) {
          // New format: object with url and originalname
          fileUrl = fileData.url;
          fileName = fileData.originalname || fileData.name || fileUrl.split('/').pop() || `file_${i + 1}`;
        } else if (typeof fileData === 'string') {
          // Legacy format: just a URL string
          fileUrl = fileData;
          fileName = fileUrl.split('/').pop() || `file_${i + 1}`;
        } else {
          fileUrl = String(fileData);
          fileName = fileUrl.split('/').pop() || `file_${i + 1}`;
        }
        
        // Ensure fileName has an extension
        if (!fileName.includes('.')) {
          const urlExt = fileUrl.split('.').pop()?.split('?')[0] || '';
          if (urlExt && urlExt.length <= 5) {
            fileName = `${fileName}.${urlExt}`;
          }
        }
        
        // Format filename for zip: AssignmentName_FirstName_LastName_FileNumber.extension
        const fileExtension = path.extname(fileName);
        const formattedFileName = lastName 
          ? `${assignmentName}_${firstName}_${lastName}_${i + 1}${fileExtension}`
          : `${assignmentName}_${firstName}_${i + 1}${fileExtension}`;
        
        fileName = formattedFileName;
        
        // Check if it's a Cloudinary URL
        if (fileUrl.includes('cloudinary.com')) {
          // For Cloudinary URLs, we need to fetch the file and add it to the zip
          try {
            const https = require('https');
            const http = require('http');
            
            // Get the raw file URL (replace /image/upload/ with /raw/upload/ if needed)
            let fetchUrl = fileUrl;
            if (fileUrl.includes('/image/upload/') && (fileUrl.includes('.pdf') || fileUrl.includes('.doc') || fileUrl.includes('.docx'))) {
              fetchUrl = fileUrl.replace('/image/upload/', '/raw/upload/');
            }
            
            const parsedUrl = new URL(fetchUrl);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            // Fetch file from Cloudinary and add to archive
            await new Promise((resolve, reject) => {
              client.get(fetchUrl, (response) => {
                if (response.statusCode === 200) {
                  archive.append(response, { name: fileName });
                  filesAdded++;
                  resolve();
                } else if (response.statusCode === 301 || response.statusCode === 302) {
                  // Handle redirects
                  const redirectUrl = response.headers.location;
                  const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                  redirectProtocol.get(redirectUrl, (redirectResponse) => {
                    if (redirectResponse.statusCode === 200) {
                      archive.append(redirectResponse, { name: fileName });
                      filesAdded++;
                      resolve();
                    } else {
                      reject(new Error(`Failed to fetch file: ${redirectResponse.statusCode}`));
                    }
                  }).on('error', reject);
                } else {
                  reject(new Error(`Failed to fetch file: ${response.statusCode}`));
                }
              }).on('error', (err) => {
                reject(err);
              });
            });
          } catch (err) {
            // Error already handled in promise rejection
          }
        } else {
          // For local files
          const fullPath = path.join(__dirname, '..', fileUrl);

          if (fsSync.existsSync(fullPath)) {
            archive.file(fullPath, { name: fileName });
            filesAdded++;
          } else {
            // Try to download from URL if it's a valid URL
            if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
              try {
                const https = require('https');
                const http = require('http');
                const protocol = fileUrl.startsWith('https') ? https : http;
                await new Promise((resolve, reject) => {
                  protocol.get(fileUrl, (response) => {
                    if (response.statusCode === 200) {
                      archive.append(response, { name: fileName });
                      filesAdded++;
                      resolve();
                    } else if (response.statusCode === 301 || response.statusCode === 302) {
                      const redirectUrl = response.headers.location;
                      const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
                      redirectProtocol.get(redirectUrl, (redirectResponse) => {
                        if (redirectResponse.statusCode === 200) {
                          archive.append(redirectResponse, { name: fileName });
                          filesAdded++;
                          resolve();
                        } else {
                          reject(new Error(`Failed to fetch file: ${redirectResponse.statusCode}`));
                        }
                      }).on('error', reject);
                    } else {
                      reject(new Error(`Failed to fetch file: ${response.statusCode}`));
                    }
                  }).on('error', reject);
                });
              } catch (err) {
                // Error already handled in promise rejection
              }
            }
          }
        }
      }

      if (filesAdded === 0) {
        archive.abort();
        return res.status(404).json({ message: 'No files found on server' });
      }

      archive.finalize();
      return;
    }

  } catch (error) {
    console.error('[DownloadSingleSubmission] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
}; 