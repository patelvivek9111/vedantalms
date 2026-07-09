const Course = require('../models/course.model');
const { resolveAssignmentGrade, buildGradesMapForStudent } = require('../utils/gradeCalculation');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const { calculateCourseGradeForStudent } = require('../services/gradeCalculation.service');
const discussionReplyService = require('../services/discussionReply.service');
const {
  getSemesterFromCourse,
  isValidTerm,
  compareSemesters,
  formatCourseTranscriptLabel,
} = require('../utils/semesterUtils');

// GET /api/reports/semesters
exports.getAvailableSemesters = async (req, res) => {
  try {
    const studentId = req.user._id;
    const courses = await Course.find({ students: studentId }).select(
      'semester createdAt academicYearLabel scheduleType'
    );

    const semesterMap = new Map();
    courses.forEach((course) => {
      const semester = getSemesterFromCourse(course);
      const key = `${semester.term}::${semester.year}`;
      semesterMap.set(key, {
        term: semester.term,
        year: semester.year,
        label: course.academicYearLabel || `${semester.term} ${semester.year}`,
      });
    });

    const semesters = Array.from(semesterMap.values()).sort(compareSemesters);

    res.json({ success: true, data: semesters });
  } catch (error) {
    console.error('Error fetching semesters:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch semesters', error: error.message });
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

    if (!isValidTerm(term)) {
      return res.status(400).json({
        success: false,
        message: `Invalid term. Must be one of: ${require('../utils/semesterUtils').VALID_TERMS.join(', ')}`,
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
    const getSemesterWithDefaults = (course) => getSemesterFromCourse(course);

    // Find all courses for this student (we'll filter by semester after fetching)
    const allCourses = await Course.find({
      students: studentId,
      published: true
    })
      .populate('instructor', 'firstName lastName')
      .select('title catalog gradeScale groups semester createdAt scheduleType academicYearLabel');

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
      
      // Map threads to assignment format
      const discussionAssignments = [];
      for (const thread of threads) {
        const studentGradeObj = thread.studentGrades.find(g => g.student.toString() === studentId.toString());
        const hasSubmitted = await discussionReplyService.hasReplyByUser(thread, studentId);
        discussionAssignments.push({
          _id: thread._id,
          title: thread.title,
          group: thread.group || 'Discussions',
          totalPoints: thread.totalPoints || 0,
          isDiscussion: true,
          published: thread.published !== false,
          grade: resolveAssignmentGrade({ discussionGradeRow: studentGradeObj || null }),
          dueDate: thread.dueDate || null,
          hasSubmitted
        });
      }

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

      const courseCode = course.catalog?.subject || course.title.split(' ')[0] || 'N/A';
      // Default credit hours: respect explicit 0 (K-12); full-year courses default to 0
      const creditHours =
        course.catalog?.creditHours != null
          ? course.catalog.creditHours
          : course.scheduleType === 'full_year'
            ? 0
            : 3;

      courseGrades.push({
        courseId: course._id.toString(),
        courseTitle: course.title,
        courseCode: courseCode,
        creditHours: creditHours,
        finalGrade: totalPercent,
        letterGrade: letterGrade,
        semester: course.semester || { term, year: parseInt(year) },
        academicYearLabel: course.academicYearLabel || null,
        scheduleType: course.scheduleType || 'single_term',
        periodLabel: formatCourseTranscriptLabel(course),
        gradingPeriodBreakdown: gradeResult.gradingPeriodBreakdown || [],
        catalogStartDate: course.catalog?.startDate || null,
        catalogEndDate: course.catalog?.endDate || null,
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

/** GET /api/reports/report-card — student progress report (Excel) with period columns */
exports.getStudentReportCard = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { term, year } = req.query;
    if (!term || !year) {
      return res.status(400).json({ success: false, message: 'Term and year are required' });
    }
    if (!isValidTerm(term)) {
      return res.status(400).json({ success: false, message: 'Invalid term' });
    }
    const yearNum = parseInt(year, 10);
    if (Number.isNaN(yearNum)) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }

    const ferpaAudit = require('../services/ferpaAudit.service');
    await ferpaAudit.recordTranscriptAccess(req, {
      studentId,
      term,
      year: yearNum,
      mode: 'report_card_download',
    }).catch(() => {});

    const { buildStudentReportCardWorkbook } = require('../services/reportCardExport.service');
    const buffer = await buildStudentReportCardWorkbook(studentId, term, yearNum);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-card-${term}-${yearNum}.xlsx"`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating report card:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report card' });
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
