const ExcelJS = require('exceljs');
const Course = require('../models/course.model');
const CourseGradingPeriod = require('../models/courseGradingPeriod.model');
const { calculateCourseGradeForStudent } = require('./gradeCalculation.service');
const { buildStudentCourseGradeContext } = require('./studentCourseGradeData.service');
const { getLetterGrade } = require('../utils/gradeCalculation');
const { formatCourseTranscriptLabel } = require('../utils/semesterUtils');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

async function buildStudentReportCardWorkbook(studentId, term, year) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MySl8te';
  workbook.created = new Date();

  const meta = workbook.addWorksheet('Info');
  meta.addRow(['Report card', '']);
  meta.addRow(['Student ID', String(studentId)]);
  meta.addRow(['Term', term]);
  meta.addRow(['Year', year]);
  meta.addRow(['Generated', new Date().toISOString()]);
  meta.addRow(['Note', 'Unofficial progress report. Official transcript may differ after finalize.']);

  const courses = await Course.find({ students: studentId, published: true })
    .select('title catalog semester scheduleType academicYearLabel groups gradeScale')
    .lean();

  const matching = courses.filter((c) => {
    const sem = getSemesterFromCourse(c);
    return sem.term === term && sem.year === Number(year);
  });

  const ws = workbook.addWorksheet('Report Card');
  const header = [
    'Course',
    'Academic period',
    'Q1 / Term 1 %',
    'Q1 / Term 1 Letter',
    'Q2 / Term 2 %',
    'Q2 / Term 2 Letter',
    'Q3 %',
    'Q3 Letter',
    'Q4 %',
    'Q4 Letter',
    'Course total %',
    'Course letter',
  ];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };

  for (const course of matching) {
    const periods = await CourseGradingPeriod.find({ course: course._id })
      .sort({ position: 1 })
      .lean();

    const { allAssignments, grades, submissionMap } = await buildStudentCourseGradeContext(
      course,
      studentId
    );

    const gradeResult = await calculateCourseGradeForStudent(
      studentId,
      course,
      allAssignments,
      grades,
      submissionMap,
      { term, year: Number(year) }
    );

    const breakdown = gradeResult.gradingPeriodBreakdown || [];
    const periodGrades = [];
    for (const period of periods) {
      const row = breakdown.find((b) => String(b.periodId) === String(period._id));
      if (row) {
        periodGrades.push(row.currentPercent, row.letterGrade);
      } else {
        const periodResult = await calculateCourseGradeForStudent(
          studentId,
          course,
          undefined,
          undefined,
          undefined,
          { gradingPeriodId: String(period._id), term, year: Number(year) }
        );
        periodGrades.push(
          periodResult.currentPercent,
          periodResult.letterGrade ||
            (periodResult.currentPercent != null
              ? getLetterGrade(periodResult.currentPercent, course.gradeScale)
              : '')
        );
      }
    }

    while (periodGrades.length < 8) periodGrades.push('', '');

    ws.addRow([
      course.title,
      formatCourseTranscriptLabel(course),
      ...periodGrades.slice(0, 8),
      gradeResult.totalPercent ?? '',
      gradeResult.letterGrade ?? '',
    ]);
  }

  ws.columns.forEach((col) => {
    col.width = 14;
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildStudentReportCardWorkbook,
};
