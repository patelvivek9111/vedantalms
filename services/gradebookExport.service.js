const ExcelJS = require('exceljs');
const { getLetterGrade } = require('../utils/gradeCalculation');
const { getGradebookCellForExport } = require('../shared/grading/gradebookCell.cjs');
const { EXCUSED_GRADE } = require('../shared/grading/gradeValues.cjs');
const { getFullGradebookDataset, normalizeStudentId } = require('./gradebookData.service');
const { calculateCourseGradeForStudent } = require('./gradeCalculation.service');
const { buildStudentCourseGradeContext } = require('./studentCourseGradeData.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const CourseGradingPeriod = require('../models/courseGradingPeriod.model');
const gradingPeriodRollupService = require('./gradingPeriodRollup.service');

/** Light fills aligned with the on-screen gradebook pill colors (matches frontend export). */
const MARKER_FILL = {
  GREEN: 'FFD1FAE5',
  YELLOW: 'FFFEF3C7',
  ORANGE: 'FFFED7AA',
  RED: 'FFFECACA',
  BLUE: 'FFDBEAFE',
  GRAY: 'FFF3F4F6',
  PURPLE: 'FFE9D5FF',
  PENDING: 'FFE5E7EB',
};

const HEADER_FILL = 'FFE7E6E6';

function letterGradeFill(letter) {
  switch (String(letter || '').charAt(0)) {
    case 'A':
      return 'FFD1FAE5';
    case 'B':
      return 'FFDDEBF7';
    case 'C':
      return 'FFFEF9C3';
    case 'D':
      return 'FFFFEDD5';
    case 'F':
      return 'FFFECACA';
    default:
      return undefined;
  }
}

function applyFill(cell, argb) {
  if (!argb) return;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function round2(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : '';
}

async function buildGradebookDataset(courseId, options = {}) {
  return getFullGradebookDataset(courseId, undefined, options);
}

/** Human-readable label for a grading period selection, used in metadata/filename. */
async function resolvePeriodLabel(courseId, gradingPeriodId) {
  if (!gradingPeriodId) return 'All grading periods';
  const period = await CourseGradingPeriod.findOne({
    _id: gradingPeriodId,
    course: courseId,
  })
    .select('name')
    .lean();
  return period?.name || 'Selected period';
}

async function buildGradebookWorkbookBuffer(dataset, options = {}) {
  const { course, students, assignments, policyMeta } = dataset;
  const gradingPeriodId = options.gradingPeriodId || null;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vedanta LMS';
  workbook.created = new Date();

  const courseId = course._id || course.id;
  const periods = await gradingPeriodRollupService.listCoursePeriods(courseId);
  // Show per-period breakdown columns only when exporting *all* periods and weights are set.
  const showPeriodBreakdown =
    !gradingPeriodId &&
    gradingPeriodRollupService.shouldUseWeightedRollup(periods) &&
    periods.length > 0;
  const periodLabel = await resolvePeriodLabel(courseId, gradingPeriodId);

  const meta = workbook.addWorksheet('Metadata');
  meta.addRow(['Course', course.title || String(courseId)]);
  meta.addRow(['Grading period', periodLabel]);
  meta.addRow(['Policy hash', policyMeta?.policyHash || '']);
  meta.addRow(['Policy version', policyMeta?.policyVersion || '']);
  meta.addRow(['Grading engine', policyMeta?.gradingEngineVersion || '']);
  meta.addRow(['Exported at', new Date().toISOString()]);
  meta.addRow([
    'Legend',
    'Green = strong, yellow/orange = mid, red = missing/low, blue = submitted not graded, gray = excused/unpublished.',
  ]);
  if (showPeriodBreakdown) {
    meta.addRow([
      'Note',
      'Overall % is the weighted average across grading periods (Canvas-style).',
    ]);
  }
  meta.getColumn(1).font = { bold: true };
  meta.getColumn(1).width = 16;
  meta.getColumn(2).width = 80;

  const ws = workbook.addWorksheet('Gradebook', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  const periodColumns = showPeriodBreakdown ? periods : [];
  const header = [
    'Student',
    'Email',
    ...assignments.map((a) => a.title || 'Assignment'),
    ...periodColumns.map((p) => `${p.name} %`),
    'Total %',
    'Letter',
  ];
  const headerRow = ws.addRow(header);
  headerRow.font = { bold: true, size: 10 };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 32;
  headerRow.eachCell((cell) => applyFill(cell, HEADER_FILL));

  const { term, year } = getSemesterFromCourse(course);
  const grades = dataset.grades || {};
  const submissionMap = dataset.submissionMap || {};

  for (const student of students) {
    const sid = normalizeStudentId(student);
    const name =
      typeof student === 'object'
        ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
        : sid;
    const email = typeof student === 'object' ? student.email || '' : '';

    const row = [name, email];
    // Track marker per assignment column so we can color the cells after the row is added.
    const assignmentMarkers = [];
    for (const assignment of assignments) {
      const aid = String(assignment._id);
      const cell = getGradebookCellForExport(
        { _id: sid },
        assignment,
        grades,
        submissionMap,
        []
      );
      const val = grades[sid]?.[aid];
      if (val === 'excused' || val === EXCUSED_GRADE) {
        row.push('Excused');
        assignmentMarkers.push('GRAY');
      } else if (cell?.display) {
        row.push(cell.display);
        assignmentMarkers.push(cell.marker || 'PENDING');
      } else if (typeof val === 'number') {
        row.push(val);
        assignmentMarkers.push(cell?.marker || 'PENDING');
      } else {
        row.push('');
        assignmentMarkers.push(null);
      }
    }

    let totalPercent = '';
    let letter = '';
    const breakdownByPeriod = {};
    try {
      const { allAssignments, grades: gMap, submissionMap } = await buildStudentCourseGradeContext(
        course,
        sid
      );
      const gradeResult = await calculateCourseGradeForStudent(
        sid,
        course,
        allAssignments,
        gMap,
        submissionMap,
        {
          term,
          year,
          persistTranscriptSnapshot: false,
          ...(gradingPeriodId ? { gradingPeriodId } : {}),
        }
      );
      totalPercent = round2(gradeResult.totalPercent);
      letter =
        gradeResult.letterGrade ||
        (typeof gradeResult.totalPercent === 'number'
          ? getLetterGrade(gradeResult.totalPercent, course.gradeScale)
          : '');
      if (showPeriodBreakdown && Array.isArray(gradeResult.gradingPeriodBreakdown)) {
        for (const b of gradeResult.gradingPeriodBreakdown) {
          breakdownByPeriod[String(b.periodId)] = b.currentPercent;
        }
      }
    } catch {
      // leave blank on calc failure
    }

    for (const period of periodColumns) {
      row.push(round2(breakdownByPeriod[String(period._id)]));
    }

    row.push(totalPercent, letter);

    const excelRow = ws.addRow(row);
    excelRow.alignment = { vertical: 'middle', horizontal: 'center' };
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    excelRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    // Color assignment cells (columns start at 3).
    assignmentMarkers.forEach((marker, i) => {
      if (marker) applyFill(excelRow.getCell(3 + i), MARKER_FILL[marker]);
    });

    // Color the Total % and Letter columns by letter grade.
    const letterFill = letterGradeFill(letter);
    const totalCol = 3 + assignments.length + periodColumns.length;
    const totalCell = excelRow.getCell(totalCol);
    const letterCell = excelRow.getCell(totalCol + 1);
    letterCell.font = { bold: true };
    applyFill(totalCell, letterFill);
    applyFill(letterCell, letterFill);
  }

  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 24;
  const firstDataCol = 3;
  const lastCol = 2 + assignments.length + periodColumns.length + 2;
  for (let c = firstDataCol; c <= lastCol; c += 1) {
    ws.getColumn(c).width = 14;
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildGradebookDataset,
  buildGradebookWorkbookBuffer,
  resolvePeriodLabel,
};
