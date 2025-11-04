const Course = require('../models/course.model');
const { getWeightedGradeForStudent, getLetterGrade } = require('../utils/gradeCalculation');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');

// GET /api/reports/semesters
// Get all unique semesters that the student has courses in
exports.getAvailableSemesters = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Find all courses the student is enrolled in
    // Include courses with or without semester info, we'll handle defaults later
    const courses = await Course.find({ 
      students: studentId
    }).select('semester');

    // Helper function to get semester with defaults
    const getSemesterWithDefaults = (course) => {
      if (course.semester && course.semester.term && course.semester.year) {
        return { term: course.semester.term, year: course.semester.year };
      }
      // Default to current semester based on course creation date
      const now = new Date(course.createdAt || new Date());
      const month = now.getMonth();
      const year = now.getFullYear();
      
      let term = 'Fall';
      if (month >= 0 && month <= 4) {
        term = 'Spring';
      } else if (month >= 5 && month <= 6) {
        term = 'Summer';
      } else if (month === 11) {
        term = 'Winter';
      }
      
      return { term, year };
    };

    // Extract unique semesters
    const semesterSet = new Set();
    courses.forEach(course => {
      const semester = getSemesterWithDefaults(course);
      semesterSet.add(`${semester.term}-${semester.year}`);
    });

    // Convert to array of objects and sort by year (descending) then term
    const termOrder = { 'Fall': 3, 'Summer': 2, 'Spring': 1, 'Winter': 0 };
    const semesters = Array.from(semesterSet).map(s => {
      const [term, year] = s.split('-');
      return { term, year: parseInt(year) };
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return (termOrder[b.term] || 0) - (termOrder[a.term] || 0);
    });

    res.json({
      success: true,
      data: semesters
    });
  } catch (error) {
    console.error('Error fetching semesters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semesters',
      error: error.message
    });
  }
};

// GET /api/reports/transcript
// Get student transcript for a specific semester
exports.getStudentTranscript = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { term, year } = req.query;

    if (!term || !year) {
      return res.status(400).json({
        success: false,
        message: 'Term and year are required'
      });
    }

    // Helper function to get semester with defaults
    const getSemesterWithDefaults = (course) => {
      if (course.semester && course.semester.term && course.semester.year) {
        return { term: course.semester.term, year: course.semester.year };
      }
      // Default to current semester based on course creation date
      const now = new Date(course.createdAt || new Date());
      const month = now.getMonth();
      const year = now.getFullYear();
      
      let term = 'Fall';
      if (month >= 0 && month <= 4) {
        term = 'Spring';
      } else if (month >= 5 && month <= 6) {
        term = 'Summer';
      } else if (month === 11) {
        term = 'Winter';
      }
      
      return { term, year };
    };

    // Find all courses for this student (we'll filter by semester after fetching)
    const allCourses = await Course.find({
      students: studentId,
      published: true
    })
      .populate('instructor', 'firstName lastName')
      .select('title catalog gradeScale groups semester createdAt');

    // Filter courses by semester (including those with default semester)
    const courses = allCourses.filter(course => {
      const courseSemester = getSemesterWithDefaults(course);
      return courseSemester.term === term && courseSemester.year === parseInt(year);
    });

    const courseGrades = [];

    for (const course of courses) {
      // Fetch all modules for the course
      const modules = await Module.find({ course: course._id }).select('_id title');
      const moduleIds = modules.map(m => m._id);

      // Fetch all assignments for these modules
      const assignments = await Assignment.find({ module: { $in: moduleIds } });

      // Fetch all group assignments for the course
      const groupAssignmentsRaw = await Assignment.find({
        isGroupAssignment: true,
        groupSet: { $ne: null }
      }).populate({ path: 'groupSet', match: { course: course._id } });
      const groupAssignments = groupAssignmentsRaw.filter(a => a.groupSet);

      // Fetch all submissions for this student for regular assignments
      const assignmentIds = assignments.map(a => a._id);
      const regularSubmissions = await Submission.find({
        assignment: { $in: assignmentIds },
        student: studentId
      });

      // For group assignments, find the student's group and get submissions
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

      // Fetch all graded discussions (threads) for the course
      const threads = await Thread.find({ course: course._id, isGraded: true });
      
      // Helper to check if a user has replied
      function hasReplyByUser(replies, userId) {
        if (!Array.isArray(replies) || replies.length === 0) return false;
        for (const r of replies) {
          const authorId = r.author && typeof r.author === 'object' && r.author._id ? r.author._id.toString() : String(r.author || '');
          if (authorId === String(userId)) return true;
          if (Array.isArray(r.replies) && r.replies.length > 0 && hasReplyByUser(r.replies, userId)) return true;
        }
        return false;
      }

      // Map threads to assignment format
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

      // Combine all assignments
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
        ...discussionAssignments
      ];

      // Create grades object
      const grades = {};
      grades[studentId] = {};
      allAssignments.forEach(assignment => {
        if (assignment.grade !== null && assignment.grade !== undefined) {
          grades[studentId][assignment._id.toString()] = assignment.grade;
        }
      });

      // Calculate final grade
      const gradeScale = course.gradeScale || [];
      const totalPercent = getWeightedGradeForStudent(studentId, course, allAssignments, grades, submissionMap);
      const letterGrade = getLetterGrade(totalPercent, gradeScale);

      // Extract course code from catalog or title
      const courseCode = course.catalog?.subject || course.title.split(' ')[0] || 'N/A';
      // Default to 3 credit hours if not specified
      const creditHours = course.catalog?.creditHours || 3;

      courseGrades.push({
        courseId: course._id.toString(),
        courseTitle: course.title,
        courseCode: courseCode,
        creditHours: creditHours,
        finalGrade: totalPercent,
        letterGrade: letterGrade,
        semester: course.semester || { term, year: parseInt(year) }
      });
    }

    res.json({
      success: true,
      data: {
        courses: courseGrades,
        totalCredits: courseGrades.reduce((sum, course) => sum + (course.creditHours || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transcript',
      error: error.message
    });
  }
};
