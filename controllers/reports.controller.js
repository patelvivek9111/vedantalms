const Course = require('../models/course.model');
const { resolveAssignmentGrade, buildGradesMapForStudent } = require('../utils/gradeCalculation');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const { calculateCourseGradeForStudent } = require('../services/gradeCalculation.service');

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

    // Validate term
    const validTerms = ['Fall', 'Spring', 'Summer', 'Winter'];
    if (!validTerms.includes(term)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid term. Must be one of: Fall, Spring, Summer, Winter'
      });
    }

    // Validate year
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year. Must be a number between 2000 and 2100'
      });
    }

    const ferpaAudit = require('../services/ferpaAudit.service');
    await ferpaAudit.recordTranscriptAccess(req, {
      studentId,
      term,
      year: yearNum,
      mode: req.query.download === 'true' ? 'download' : 'view',
    }).catch(() => {});

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
      return courseSemester.term === term && courseSemester.year === yearNum;
    });

    const courseGrades = [];

    for (const course of courses) {
      // Fetch all modules for the course
      const modules = await Module.find({ course: course._id }).select('_id title');
      const moduleIds = modules.map(m => m._id);

      // Fetch all assignments for these modules
      const assignments = await Assignment.find({ module: { $in: moduleIds } });

      const GroupSet = require('../models/GroupSet');
      const courseGroupSets = await GroupSet.find({ course: course._id }).select('_id').lean();
      const courseGroupSetIds = courseGroupSets.map((gs) => gs._id);
      const groupAssignments =
        courseGroupSetIds.length > 0
          ? await Assignment.find({
              isGroupAssignment: true,
              groupSet: { $in: courseGroupSetIds },
            }).lean()
          : [];

      // Fetch all submissions for this student for regular assignments
      const assignmentIds = assignments.map(a => a._id);
      const regularSubmissions = await Submission.find({
        assignment: { $in: assignmentIds },
        student: studentId
      });

      // For group assignments, find the student's group and get submissions
      let groupSubmissions = [];
      for (const groupAssignment of groupAssignments) {
        const groupSetId = groupAssignment.groupSet?._id || groupAssignment.groupSet;
        const group = await Group.findOne({
          groupSet: groupSetId,
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
          grade: resolveAssignmentGrade({ discussionGradeRow: studentGradeObj || null }),
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
          grade: resolveAssignmentGrade({ submission: submissionMap[a._id.toString()] || null })
        })),
        ...groupAssignments.map(a => {
          const submission = submissionMap[a._id.toString()];
          const grade = submission
            ? resolveAssignmentGrade({
                submission: { ...submission, _memberStudentId: studentId }
              })
            : null;
          
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

      const sid = studentId.toString();
      const grades = {};
      buildGradesMapForStudent(grades, sid, allAssignments);

      const gradeResult = await calculateCourseGradeForStudent(
        sid,
        course,
        allAssignments,
        grades,
        submissionMap,
        {
          useFrozenTranscriptSnapshot: true,
          persistTranscriptSnapshot: true,
          term,
          year: yearNum,
        }
      );
      const { totalPercent, letterGrade } = gradeResult;

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
        semester: course.semester || { term, year: parseInt(year) },
        gradingPolicyVersion: gradeResult.policyVersion,
        gradingPolicyHash: gradeResult.policyHash,
        gradingEngineVersion: gradeResult.gradingEngineVersion,
        lifecycleStatus: gradeResult.lifecycleStatus,
        fromFrozenSnapshot: !!gradeResult.fromFrozenSnapshot,
      });
    }

    const payload = {
      studentId: String(studentId),
      term,
      year: yearNum,
      courses: courseGrades
        .map((c) => ({
          courseId: c.courseId,
          finalPercent: c.finalGrade,
          letterGrade: c.letterGrade,
          gradingPolicyHash: c.gradingPolicyHash,
          gradingPolicyVersion: c.gradingPolicyVersion,
          gradingEngineVersion: c.gradingEngineVersion,
          lifecycleStatus: c.lifecycleStatus,
        }))
        .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    };
    const { hashTranscriptPayload } = require('../shared/grading/transcriptHash.cjs');
    const transcriptHash = hashTranscriptPayload(payload);

    res.json({
      success: true,
      data: {
        courses: courseGrades,
        totalCredits: courseGrades.reduce((sum, course) => sum + (course.creditHours || 0), 0),
        transcriptHash,
      },
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

/** POST /api/reports/transcript/issue — registrar official issuance log */
exports.issueStudentTranscript = async (req, res) => {
  try {
    const { studentId, term, year, notes } = req.body;
    if (!studentId || !term || !year) {
      return res.status(400).json({
        success: false,
        message: 'studentId, term, and year are required',
      });
    }

    const transcriptIssuanceService = require('../services/transcriptIssuance.service');
    const result = await transcriptIssuanceService.issueOfficialTranscript({
      studentId,
      term,
      year: Number(year),
      issuedBy: req.user,
      notes,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        issueLog: result.log,
        transcriptHash: result.transcriptHash,
        courseCount: result.payload.courses.length,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to issue transcript',
    });
  }
};

/** GET /api/reports/transcript/issue-history/:studentId */
exports.getTranscriptIssuanceHistory = async (req, res) => {
  try {
    const { term, year } = req.query;
    if (!term || !year) {
      return res.status(400).json({
        success: false,
        message: 'term and year query params are required',
      });
    }

    const transcriptIssuanceService = require('../services/transcriptIssuance.service');
    const history = await transcriptIssuanceService.listIssuanceHistory(
      req.params.studentId,
      term,
      Number(year)
    );

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
