const ExcelJS = require('exceljs');
const { getLetterGrade } = require('../utils/gradeCalculation');
const { getGradebookCellForExport } = require('../shared/grading/gradebookCell.cjs');
const { EXCUSED_GRADE } = require('../shared/grading/gradeValues.cjs');
const { getFullGradebookDataset, normalizeStudentId } = require('./gradebookData.service');
const { calculateCourseGradeForStudent } = require('./gradeCalculation.service');
const { buildStudentCourseGradeContext } = require('./studentCourseGradeData.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

async function buildGradebookDataset(courseId) {
  return getFullGradebookDataset(courseId);
}

async function buildGradebookWorkbookBuffer(dataset) {
  const { course, students, assignments, grades, policyMeta } = dataset;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vedanta LMS';
  workbook.created = new Date();

  const meta = workbook.addWorksheet('Metadata');
  meta.addRow(['Course', course.title || course._id]);
  meta.addRow(['Policy hash', policyMeta?.policyHash || '']);
  meta.addRow(['Policy version', policyMeta?.policyVersion || '']);
  meta.addRow(['Grading engine', policyMeta?.gradingEngineVersion || '']);
  meta.addRow(['Exported at', new Date().toISOString()]);

  const ws = workbook.addWorksheet('Gradebook');
  const header = [
    'Student',
    'Email',
    ...assignments.map((a) => a.title || 'Assignment'),
    'Total %',
    'Letter',
  ];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };

  const { term, year } = getSemesterFromCourse(course);

  for (const student of students) {
    const sid = normalizeStudentId(student);
    const name =
      typeof student === 'object'
        ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
        : sid;
    const email = typeof student === 'object' ? student.email || '' : '';

    const row = [name, email];
    for (const assignment of assignments) {
      const aid = String(assignment._id);
      const cell = getGradebookCellForExport(
        { _id: sid },
        { _id: aid, dueDate: assignment.dueDate, published: assignment.published !== false },
        grades,
        {},
        []
      );
      const val = grades[sid]?.[aid];
      if (val === 'excused' || val === EXCUSED_GRADE) {
        row.push('Excused');
      } else if (cell?.label) {
        row.push(cell.label);
      } else if (typeof val === 'number') {
        row.push(val);
      } else {
        row.push('');
      }
    }

    let totalPercent = '';
    let letter = '';
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
        { term, year, persistTranscriptSnapshot: false }
      );
      totalPercent = gradeResult.totalPercent;
      letter = gradeResult.letterGrade || getLetterGrade(totalPercent, course.gradeScale);
    } catch {
      // leave blank on calc failure
    }

    row.push(totalPercent, letter);
    ws.addRow(row);
  }

  ws.columns.forEach((col) => {
    col.width = 14;
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildGradebookDataset,
  buildGradebookWorkbookBuffer,
};
