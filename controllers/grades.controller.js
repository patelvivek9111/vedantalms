const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const { calculateFinalGradeWithWeightedGroups, getWeightedGradeForStudent, getLetterGrade } = require('../utils/gradeCalculation');
const { getJson, setJson } = require('../utils/cache');

// GET /api/grades/student/course/:courseId
exports.getStudentCourseGrade = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id;
    const cacheKey = `grades:student:${studentId}:course:${courseId}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch course with groups and gradeScale
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const groups = course.groups || [];
    const gradeScale = course.gradeScale || [];

    // Fetch all modules for the course
    const modules = await Module.find({ course: courseId }).select('_id title').lean();
    const moduleIds = modules.map(m => m._id);

    // Fetch all assignments for these modules
    const assignments = await Assignment.find({ module: { $in: moduleIds } }).lean();

    // Fetch only the current course's group assignments via GroupSet index
    const courseGroupSets = await GroupSet.find({ course: courseId }).select('_id').lean();
    const courseGroupSetIds = courseGroupSets.map((groupSet) => groupSet._id);
    const groupAssignments = courseGroupSetIds.length > 0
      ? await Assignment.find({
          isGroupAssignment: true,
          groupSet: { $in: courseGroupSetIds }
        }).lean()
      : [];

    // Fetch all submissions for this student for regular assignments
    const assignmentIds = assignments.map(a => a._id);
    const regularSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    }).lean();
    
    // Group assignments: batch-resolve groups + submissions (avoid N+1 per group assignment)
    let groupSubmissions = [];
    if (groupAssignments.length > 0) {
      const groupSetIds = [...new Set(groupAssignments.map((a) => a.groupSet).filter(Boolean).map(String))].map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const groups = await Group.find({
        groupSet: { $in: groupSetIds },
        members: studentId
      })
        .select('_id groupSet')
        .lean();
      const groupBySet = new Map(groups.map((g) => [String(g.groupSet), g]));
      const groupIds = groups.map((g) => g._id);
      const groupAssignmentIds = groupAssignments.map((a) => a._id);
      const groupSubs =
        groupIds.length > 0
          ? await Submission.find({
              assignment: { $in: groupAssignmentIds },
              group: { $in: groupIds }
            }).lean()
          : [];
      const subByAssignmentGroup = new Map(
        groupSubs.map((s) => [`${String(s.assignment)}:${String(s.group)}`, s])
      );
      for (const groupAssignment of groupAssignments) {
        const group = groupBySet.get(String(groupAssignment.groupSet));
        if (!group) continue;
        const submission = subByAssignmentGroup.get(`${String(groupAssignment._id)}:${String(group._id)}`);
        if (submission) groupSubmissions.push(submission);
      }
    }

    // Combine all submissions
    const allSubmissions = [...regularSubmissions, ...groupSubmissions];
    const submissionMap = {};
    allSubmissions.forEach(sub => {
      submissionMap[sub.assignment.toString()] = sub;
    });

    // Fetch all graded discussions (threads) for the course
    const threads = await Thread.find({ course: courseId, isGraded: true }).lean();
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
            const memberGrade = submission.memberGrades.find((mg) => {
              const memberId = mg.student && (mg.student._id || mg.student);
              return memberId && memberId.toString() === studentId.toString();
            });
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

    const payload = { totalPercent, letterGrade };
    await setJson(cacheKey, payload, 60);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/grades/student/course/:courseId/legacy
exports.getStudentCourseGradeLegacy = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id;

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
    const cacheKey = `grades:course-average:${courseId}:${userId}`;
    const cached = await getJson(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch course
    const course = await Course.findById(courseId).lean();
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
    const assignments = await Assignment.find({ module: { $in: moduleIds } }).lean();

    // Fetch only course-relevant group assignments via GroupSet index
    const courseGroupSets = await GroupSet.find({ course: courseId }).select('_id').lean();
    const courseGroupSetIds = courseGroupSets.map((groupSet) => groupSet._id);
    const groupAssignments = courseGroupSetIds.length > 0
      ? await Assignment.find({
          isGroupAssignment: true,
          groupSet: { $in: courseGroupSetIds }
        }).lean()
      : [];

    // Fetch all graded discussions
    const threads = await Thread.find({ course: courseId, isGraded: true }).lean();
    
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
    const discussionGradeMap = new Map();
    for (const discussion of discussionAssignments) {
      for (const gradeRow of discussion.studentGrades || []) {
        discussionGradeMap.set(
          `${String(discussion._id)}:${String(gradeRow.student)}`,
          gradeRow.grade
        );
      }
    }

    // Preload regular submissions for all students in one query
    const assignmentIds = assignments.map(a => a._id);
    const regularSubmissionsAll = await Submission.find({
      assignment: { $in: assignmentIds },
      student: { $in: students }
    }).lean();

    const regularByStudent = new Map();
    for (const submission of regularSubmissionsAll) {
      const key = String(submission.student);
      if (!regularByStudent.has(key)) {
        regularByStudent.set(key, []);
      }
      regularByStudent.get(key).push(submission);
    }

    // Preload group membership for all students and group sets
    const groupSetIds = groupAssignments
      .map(a => a.groupSet?._id)
      .filter(Boolean);
    const groupsAll = groupSetIds.length > 0
      ? await Group.find({
          groupSet: { $in: groupSetIds },
          members: { $in: students }
        }).select('_id groupSet members').lean()
      : [];

    const studentGroupBySet = new Map();
    for (const group of groupsAll) {
      for (const memberId of group.members || []) {
        studentGroupBySet.set(`${String(memberId)}:${String(group.groupSet)}`, String(group._id));
      }
    }

    // Preload group submissions in one query and index by assignment+group
    const groupAssignmentIds = groupAssignments.map(a => a._id);
    const groupIds = [...new Set(groupsAll.map(g => String(g._id)))];
    const groupSubmissionsAll = (groupAssignmentIds.length > 0 && groupIds.length > 0)
      ? await Submission.find({
          assignment: { $in: groupAssignmentIds },
          group: { $in: groupIds }
        }).lean()
      : [];
    const groupSubmissionMap = new Map();
    for (const submission of groupSubmissionsAll) {
      groupSubmissionMap.set(`${String(submission.assignment)}:${String(submission.group)}`, submission);
    }

    // Calculate grade for each student
    const studentGrades = [];
    
    for (const studentId of students) {
      try {
        // Get preloaded regular submissions for this student
        const regularSubmissions = regularByStudent.get(String(studentId)) || [];

        // Resolve preloaded group submissions
        let groupSubmissions = [];
        for (const groupAssignment of groupAssignments) {
          const groupId = studentGroupBySet.get(`${String(studentId)}:${String(groupAssignment.groupSet)}`);
          if (groupId) {
            const submission = groupSubmissionMap.get(`${String(groupAssignment._id)}:${groupId}`);
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
                  mg => mg.student && String(mg.student._id || mg.student) === studentId.toString()
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
            const discussionGrade = discussionGradeMap.get(
              `${String(discussion._id)}:${String(studentId)}`
            );
            return {
              _id: discussion._id,
              title: discussion.title,
              group: discussion.group,
              totalPoints: discussion.totalPoints || 0,
              isDiscussion: true,
              published: discussion.published,
              grade: typeof discussionGrade === 'number' ? discussionGrade : null,
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
        
        // Only include if grade is valid (not NaN)
        if (!isNaN(totalPercent) && isFinite(totalPercent)) {
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

    const sum = studentGrades.reduce((acc, grade) => acc + grade, 0);
    const average = sum / studentGrades.length;

    const payload = { 
      average: Math.round(average * 100) / 100, // Round to 2 decimal places
      studentCount: students.length,
      gradedCount: studentGrades.length
    };
    await setJson(cacheKey, payload, 45);
    res.json(payload);
  } catch (error) {
    console.error('Error calculating class average:', error);
    res.status(500).json({ message: error.message });
  }
};