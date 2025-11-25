const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const { calculateFinalGradeWithWeightedGroups, getWeightedGradeForStudent, getLetterGrade } = require('../utils/gradeCalculation');

// GET /api/grades/student/course/:courseId
exports.getStudentCourseGrade = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id || req.user.id;
    
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    // Fetch course with groups and gradeScale
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const groups = course.groups || [];
    const gradeScale = course.gradeScale || [];

    // Fetch all modules for the course
    const modules = await Module.find({ course: courseId }).select('_id title');
    const moduleIds = modules.map(m => m._id);

    // Fetch all assignments for these modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } });

    // Fetch all group assignments for the course (by groupSet.course)
    const groupAssignmentsRaw = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    }).populate({ path: 'groupSet', match: { course: courseId } });
    // Only keep group assignments for this course
    const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);

    // Fetch all submissions for this student for regular assignments
    const assignmentIds = assignments.map(a => a._id);
    const regularSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    });
    
    // For group assignments, find the student's group for each groupSet and get submissions
    let groupSubmissions = [];
    for (const groupAssignment of groupAssignments) {
      // Find the student's group in this groupSet
      const group = await Group.findOne({
        groupSet: groupAssignment.groupSet._id,
        members: studentId
      });
      if (group) {
        // Find the submission for this group assignment and group
        const submission = await Submission.findOne({
          assignment: groupAssignment._id,
          group: group._id
        }).populate('memberGrades.student', 'firstName lastName');
        if (submission) {
          groupSubmissions.push(submission);
        }
      }
    }

    // Combine all submissions
    const allSubmissions = [...regularSubmissions, ...groupSubmissions];
    const submissionMap = {};
    allSubmissions.forEach(sub => {
      submissionMap[sub.assignment.toString()] = sub;
    });

    // Fetch all graded discussions (threads) for the course
    const threads = await Thread.find({ course: courseId, isGraded: true });
    // Helper to check if a user has replied anywhere in a nested replies tree
    function hasReplyByUser(replies, userId) {
      if (!Array.isArray(replies) || replies.length === 0) return false;
      for (const r of replies) {
        const authorId = r.author && typeof r.author === 'object' && r.author._id ? r.author._id.toString() : String(r.author || '');
        if (authorId === String(userId)) return true;
        if (Array.isArray(r.replies) && r.replies.length > 0 && hasReplyByUser(r.replies, userId)) return true;
      }
      return false;
    }
    // For each thread, find the student's grade and submission status
    const discussionAssignments = threads.map(thread => {
      const studentGradeObj = thread.studentGrades.find(g => g.student.toString() === studentId.toString());
      const hasSubmitted = hasReplyByUser(thread.replies, studentId);
      return {
        _id: thread._id,
        title: thread.title,
        group: thread.group || 'Discussions',
        totalPoints: thread.totalPoints || 0,
        isDiscussion: true,
        published: thread.published !== false,
        grade: studentGradeObj ? studentGradeObj.grade : null,
        dueDate: thread.dueDate || null,
        hasSubmitted
      };
    });

    // Combine assignments and discussionAssignments for grade calculation
    const allAssignments = [
      ...assignments.map(a => ({
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        assignment: a,
        dueDate: a.dueDate,
        published: a.published,
        grade: submissionMap[a._id.toString()] && typeof submissionMap[a._id.toString()].grade === 'number'
          ? submissionMap[a._id.toString()].grade
          : null
      })),
      ...groupAssignments.map(a => {
        const submission = submissionMap[a._id.toString()];
        let grade = null;
        
        if (submission) {
          if (submission.useIndividualGrades && submission.memberGrades) {
            // Find the individual grade for this student
            const memberGrade = submission.memberGrades.find(
              mg => mg.student && mg.student._id.toString() === studentId.toString()
            );
            grade = memberGrade ? memberGrade.grade : null;
          } else {
            // Use the group grade for all members
            grade = typeof submission.grade === 'number' ? submission.grade : null;
          }
        }
        
        return {
          _id: a._id,
          title: a.title,
          group: a.group,
          totalPoints: a.totalPoints || 0,
          questions: a.questions,
          isDiscussion: false,
          assignment: a,
          dueDate: a.dueDate,
          published: a.published,
          grade: grade
        };
      }),
      ...discussionAssignments
    ];

    // Create grades object for the utility function
    const grades = {};
    grades[studentId] = {};
    allAssignments.forEach(assignment => {
      if (assignment.grade !== null && assignment.grade !== undefined) {
        grades[studentId][assignment._id.toString()] = assignment.grade;
      }
    });

    // Calculate weighted grade using the legacy function to match teacher gradebook
    const totalPercent = getWeightedGradeForStudent(studentId, course, allAssignments, grades, submissionMap);
    const letterGrade = getLetterGrade(totalPercent, gradeScale);

    res.json({ totalPercent, letterGrade });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/student/course/:courseId/legacy
exports.getStudentCourseGradeLegacy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id || req.user.id;
    
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    // Fetch course with groups and gradeScale
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const groups = course.groups || [];
    const gradeScale = course.gradeScale || [];

    // Fetch all modules for the course
    const modules = await Module.find({ course: courseId }).select('_id title');
    const moduleIds = modules.map(m => m._id);

    // Fetch all assignments for these modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } });

    // Fetch all group assignments for the course (by groupSet.course)
    const groupAssignmentsRaw = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    }).populate({ path: 'groupSet', match: { course: courseId } });
    // Only keep group assignments for this course
    const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);

    // Fetch all submissions for this student for regular assignments
    const assignmentIds = assignments.map(a => a._id);
    const regularSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    });
    
    // For group assignments, find the student's group for each groupSet and get submissions
    let groupSubmissions = [];
    for (const groupAssignment of groupAssignments) {
      // Find the student's group in this groupSet
      const group = await Group.findOne({
        groupSet: groupAssignment.groupSet._id,
        members: studentId
      });
      if (group) {
        // Find the submission for this group assignment and group
        const submission = await Submission.findOne({
          assignment: groupAssignment._id,
          group: group._id
        }).populate('memberGrades.student', 'firstName lastName');
        if (submission) {
          groupSubmissions.push(submission);
        }
      }
    }

    // Combine all submissions
    const allSubmissions = [...regularSubmissions, ...groupSubmissions];
    const submissionMap = {};
    allSubmissions.forEach(sub => {
      submissionMap[sub.assignment.toString()] = sub;
    });

    // Fetch all graded discussions (threads) for the course
    const threads = await Thread.find({ course: courseId, isGraded: true });
    // For each thread, find the student's grade
    const discussionAssignments = threads.map(thread => {
      const studentGradeObj = thread.studentGrades.find(g => g.student.toString() === studentId.toString());
      return {
        _id: thread._id,
        title: thread.title,
        group: thread.group || 'Discussions',
        totalPoints: thread.totalPoints || 0,
        isDiscussion: true,
        grade: studentGradeObj ? studentGradeObj.grade : null,
        dueDate: thread.dueDate || null
      };
    });

    // Combine assignments and discussionAssignments for grade calculation
    const allAssignments = [
      ...assignments.map(a => ({
        _id: a._id,
        title: a.title,
        group: a.group,
        totalPoints: a.totalPoints || 0,
        questions: a.questions,
        isDiscussion: false,
        assignment: a,
        dueDate: a.dueDate,
        published: a.published,
        grade: submissionMap[a._id.toString()] && typeof submissionMap[a._id.toString()].grade === 'number'
          ? submissionMap[a._id.toString()].grade
          : null
      })),
      ...groupAssignments.map(a => {
        const submission = submissionMap[a._id.toString()];
        let grade = null;
        
        if (submission) {
          if (submission.useIndividualGrades && submission.memberGrades) {
            // Find the individual grade for this student
            const memberGrade = submission.memberGrades.find(
              mg => mg.student && mg.student._id.toString() === studentId.toString()
            );
            grade = memberGrade ? memberGrade.grade : null;
          } else {
            // Use the group grade for all members
            grade = typeof submission.grade === 'number' ? submission.grade : null;
      }
        }
        
        return {
          _id: a._id,
          title: a.title,
          group: a.group,
          totalPoints: a.totalPoints || 0,
          questions: a.questions,
          isDiscussion: false,
          assignment: a,
          dueDate: a.dueDate,
          published: a.published,
          grade: grade
        };
      }),
      ...discussionAssignments
    ];

    // Create grades object for the utility function
    const grades = {};
    grades[studentId] = {};
    allAssignments.forEach(assignment => {
      if (assignment.grade !== null && assignment.grade !== undefined) {
        grades[studentId][assignment._id.toString()] = assignment.grade;
      }
    });

    // Calculate weighted grade using the legacy function
    const totalPercent = getWeightedGradeForStudent(studentId, course, allAssignments, grades, submissionMap);
    const letterGrade = getLetterGrade(totalPercent, gradeScale);

    res.json({ totalPercent, letterGrade });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/course/:courseId/average
exports.getCourseClassAverage = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user._id;

    // Fetch course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // Check if user is instructor or admin
    const isInstructor = course.instructor.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isInstructor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view class average' });
    }

    const students = course.students || [];
    if (students.length === 0) {
      return res.json({ average: null, studentCount: 0 });
    }

    const groups = course.groups || [];
    const gradeScale = course.gradeScale || [];

    // Fetch all modules for the course
    const modules = await Module.find({ course: courseId }).select('_id title');
    const moduleIds = modules.map(m => m._id);

    // Fetch all assignments for these modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } });

    // Fetch all group assignments for the course
    const groupAssignmentsRaw = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    }).populate({ path: 'groupSet', match: { course: courseId } });
    const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);

    // Fetch all graded discussions
    const threads = await Thread.find({ course: courseId, isGraded: true });
    
    // Helper to check if a user has replied anywhere in a nested replies tree
    function hasReplyByUser(replies, userId) {
      if (!Array.isArray(replies) || replies.length === 0) return false;
      for (const r of replies) {
        const authorId = r.author && typeof r.author === 'object' && r.author._id ? r.author._id.toString() : String(r.author || '');
        if (authorId === String(userId)) return true;
        if (Array.isArray(r.replies) && r.replies.length > 0 && hasReplyByUser(r.replies, userId)) return true;
      }
      return false;
    }

    // Build discussion assignments
    const discussionAssignments = threads.map(thread => {
      return {
        _id: thread._id,
        title: thread.title,
        group: thread.group || 'Discussions',
        totalPoints: thread.totalPoints || 0,
        isDiscussion: true,
        published: thread.published !== false,
        studentGrades: thread.studentGrades || [],
        dueDate: thread.dueDate || null,
        replies: thread.replies || []
      };
    });

    // Calculate grade for each student
    const studentGrades = [];
    
    for (const studentId of students) {
      try {
        // Fetch all submissions for this student
        const assignmentIds = assignments.map(a => a._id);
        const regularSubmissions = await Submission.find({
          assignment: { $in: assignmentIds },
          student: studentId
        });

        // Fetch group submissions
        let groupSubmissions = [];
        for (const groupAssignment of groupAssignments) {
          const group = await Group.findOne({
            groupSet: groupAssignment.groupSet._id,
            members: studentId
          });
          if (group) {
            const submission = await Submission.findOne({
              assignment: groupAssignment._id,
              group: group._id
            }).populate('memberGrades.student', 'firstName lastName');
            if (submission) {
              groupSubmissions.push(submission);
            }
          }
        }

        // Combine all submissions
        const allSubmissions = [...regularSubmissions, ...groupSubmissions];
        const submissionMap = {};
        allSubmissions.forEach(sub => {
          submissionMap[sub.assignment.toString()] = sub;
        });

        // Build all assignments with grades
        const allAssignments = [
          ...assignments.map(a => ({
            _id: a._id,
            title: a.title,
            group: a.group,
            totalPoints: a.totalPoints || 0,
            questions: a.questions,
            isDiscussion: false,
            assignment: a,
            dueDate: a.dueDate,
            published: a.published,
            grade: submissionMap[a._id.toString()] && typeof submissionMap[a._id.toString()].grade === 'number'
              ? submissionMap[a._id.toString()].grade
              : null
          })),
          ...groupAssignments.map(a => {
            const submission = submissionMap[a._id.toString()];
            let grade = null;
            
            if (submission) {
              if (submission.useIndividualGrades && submission.memberGrades) {
                const memberGrade = submission.memberGrades.find(
                  mg => mg.student && mg.student._id.toString() === studentId.toString()
                );
                grade = memberGrade ? memberGrade.grade : null;
              } else {
                grade = typeof submission.grade === 'number' ? submission.grade : null;
              }
            }
            
            return {
              _id: a._id,
              title: a.title,
              group: a.group,
              totalPoints: a.totalPoints || 0,
              questions: a.questions,
              isDiscussion: false,
              assignment: a,
              dueDate: a.dueDate,
              published: a.published,
              grade: grade
            };
          }),
          ...discussionAssignments.map(discussion => {
            const studentGradeObj = discussion.studentGrades.find(
              g => g.student && g.student.toString() === studentId.toString()
            );
            return {
              _id: discussion._id,
              title: discussion.title,
              group: discussion.group,
              totalPoints: discussion.totalPoints || 0,
              isDiscussion: true,
              published: discussion.published,
              grade: studentGradeObj ? studentGradeObj.grade : null,
              dueDate: discussion.dueDate
            };
          })
        ];

        // Create grades object
        const grades = {};
        grades[studentId.toString()] = {};
        allAssignments.forEach(assignment => {
          if (assignment.grade !== null && assignment.grade !== undefined && typeof assignment.grade === 'number') {
            grades[studentId.toString()][assignment._id.toString()] = assignment.grade;
          }
        });

        // Calculate weighted grade
        const totalPercent = getWeightedGradeForStudent(studentId.toString(), course, allAssignments, grades, submissionMap);
        
        // Only include if grade is valid (not NaN, not Infinity, and is a number)
        if (typeof totalPercent === 'number' && !isNaN(totalPercent) && isFinite(totalPercent) && totalPercent >= 0) {
          studentGrades.push(totalPercent);
        }
      } catch (error) {
        console.error(`Error calculating grade for student ${studentId}:`, error);
        // Continue with other students
      }
    }

    // Calculate average
    if (studentGrades.length === 0) {
      return res.json({ average: null, studentCount: students.length, gradedCount: 0 });
    }

    const sum = studentGrades.reduce((acc, grade) => {
      // Validate each grade is a valid number
      if (typeof grade === 'number' && isFinite(grade)) {
        return acc + grade;
      }
      return acc;
    }, 0);
    
    const average = sum / studentGrades.length;
    
    // Validate average is a valid number
    if (!isFinite(average) || isNaN(average)) {
      return res.json({ average: null, studentCount: students.length, gradedCount: studentGrades.length });
    }

    res.json({ 
      average: Math.round(average * 100) / 100, // Round to 2 decimal places
      studentCount: students.length,
      gradedCount: studentGrades.length
    });
  } catch (error) {
    console.error('Error calculating class average:', error);
    res.status(500).json({ message: error.message });
  }
};