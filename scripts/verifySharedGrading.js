#!/usr/bin/env node
/**
 * Ensures backend utils/gradeCalculation.js re-exports match shared/grading canonical modules.
 */
const path = require('path');
const shared = require(path.join(__dirname, '../shared/grading/index.cjs'));
const backend = require(path.join(__dirname, '../utils/gradeCalculation.js'));

const keys = [
  'calculateFinalGradeWithWeightedGroups',
  'getWeightedGradeForStudent',
  'getLetterGrade',
  'isExcusedGrade',
  'buildGradesMapForStudent',
  'resolveAssignmentGrade',
  'getGradebookCellForExport',
  'EXCUSED_GRADE',
];

let failed = false;
for (const key of keys) {
  if (typeof shared[key] !== typeof backend[key]) {
    console.error(`Mismatch for export "${key}": shared=${typeof shared[key]} backend=${typeof backend[key]}`);
    failed = true;
  }
}

const { case1StandardWeighted } = require(path.join(__dirname, '../tests/grading/fixtures.js'));
const scenario = case1StandardWeighted();
const sid = scenario.studentId;
const sharedPercent = shared.calculateFinalGradeWithWeightedGroups(
  sid,
  scenario.course,
  scenario.assignments,
  scenario.grades,
  scenario.submissions
);
const backendPercent = backend.calculateFinalGradeWithWeightedGroups(
  sid,
  scenario.course,
  scenario.assignments,
  scenario.grades,
  scenario.submissions
);

if (Math.abs(sharedPercent - backendPercent) > 0.0001) {
  console.error(`Case1 percent drift: shared=${sharedPercent} backend=${backendPercent}`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('Shared grading modules verified (exports + Case 1 parity).');
