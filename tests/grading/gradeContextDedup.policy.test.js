/**
 * Phase 8 — production grade paths must use the shared context builder (no duplicated fetch logic).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

describe('Grade context builder dedup (Phase 8)', () => {
  it('gradebookData.service uses computeStudentCourseGrade', () => {
    const content = fs.readFileSync(path.join(ROOT, 'services/gradebookData.service.js'), 'utf8');
    expect(content).toMatch(/computeStudentCourseGrade/);
  });

  it('getStudentCourseGrade routes through calculateCourseGradeForStudent only', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'controllers/grades.controller.js'),
      'utf8'
    );
    expect(content).toMatch(/calculateCourseGradeForStudent\s*\(/);
    expect(content).not.toMatch(/buildStudentCourseGradeContext\s*\(/);
  });

  it('gradeCalculationInputs.service uses batchThreadIdsRepliedByUser (not per-thread hasReplyByUser)', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'services/gradeCalculationInputs.service.js'),
      'utf8'
    );
    expect(content).toMatch(/batchThreadIdsRepliedByUser/);
    expect(content).not.toMatch(/hasReplyByUser\s*\(/);
    expect(content).not.toMatch(/Group\.findOne\s*\(/);
  });

  it('studentCourseGradeData.service delegates to gradeCalculationInputs', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'services/studentCourseGradeData.service.js'),
      'utf8'
    );
    expect(content).toMatch(/buildStudentGradeInputs/);
    expect(content).toMatch(/loadCourseGradeAssignments/);
  });

  it('transcript and lifecycle services use buildStudentCourseGradeContext', () => {
    for (const rel of [
      'services/transcriptRecompute.service.js',
      'services/gradeLifecycle.service.js',
      'services/gradebookExport.service.js',
    ]) {
      const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(content).toMatch(/buildStudentCourseGradeContext/);
    }
  });
});
