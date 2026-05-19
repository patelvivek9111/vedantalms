/**
 * Production grading paths must use the canonical calculator (directly or via gradeCalculation.service).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const PRODUCTION_FILES = [
  'controllers/grades.controller.js',
  'controllers/reports.controller.js',
];

const CANONICAL_PATTERNS = [
  /calculateFinalGradeWithWeightedGroups/,
  /calculateCourseGradeForStudent/,
];

describe('Canonical calculator usage in production controllers', () => {
  for (const rel of PRODUCTION_FILES) {
    it(`${rel} uses canonical grade calculation path`, () => {
      const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const usesCanonical = CANONICAL_PATTERNS.some((re) => re.test(content));
      expect(usesCanonical).toBe(true);
    });

    it(`${rel} does not call getWeightedGradeForStudent`, () => {
      const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(content).not.toMatch(/\bgetWeightedGradeForStudent\s*\(/);
    });
  }

  it('gradeCalculation.service delegates to calculateFinalGradeWithWeightedGroups', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'services/gradeCalculation.service.js'),
      'utf8'
    );
    expect(content).toMatch(/calculateFinalGradeWithWeightedGroups/);
  });
});
