#!/usr/bin/env node
/**
 * Ensures backend utils/gradeCalculation.js re-exports match shared/grading canonical modules.
 * Phase 7: expanded export checks + CJS/ESM twin parity on representative scenarios.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const shared = require(path.join(__dirname, '../shared/grading/index.cjs'));
const backend = require(path.join(__dirname, '../utils/gradeCalculation.js'));

const keys = [
  'calculateFinalGradeWithWeightedGroups',
  'calculateCurrentGradeWithWeightedGroups',
  'calculateProjectedFinalGradeWithWeightedGroups',
  'getWeightedGradeForStudent',
  'getLetterGrade',
  'isExcusedGrade',
  'buildGradesMapForStudent',
  'resolveAssignmentGrade',
  'getGradebookCellForExport',
  'isExtraCreditAssignment',
  'applyExtraCreditToCourseTotal',
  'EXCUSED_GRADE',
];

let failed = false;
for (const key of keys) {
  if (typeof shared[key] !== typeof backend[key]) {
    console.error(`Mismatch for export "${key}": shared=${typeof shared[key]} backend=${typeof backend[key]}`);
    failed = true;
  }
}

function runCase1(calc) {
  const { case1StandardWeighted } = require(path.join(__dirname, '../tests/grading/fixtures.js'));
  const scenario = case1StandardWeighted();
  const sid = scenario.studentId;
  return calc(
    sid,
    scenario.course,
    scenario.assignments,
    scenario.grades,
    scenario.submissions
  );
}

const sharedPercent = runCase1(shared.calculateFinalGradeWithWeightedGroups);
const backendPercent = runCase1(backend.calculateFinalGradeWithWeightedGroups);

if (Math.abs(sharedPercent - backendPercent) > 0.0001) {
  console.error(`Case1 percent drift: shared=${sharedPercent} backend=${backendPercent}`);
  failed = true;
}

async function verifyEsmParity() {
  const esm = await import(pathToFileURL(path.join(__dirname, '../shared/grading/index.mjs')));
  const { ALL_CANVAS_PARITY_SCENARIOS } = require(path.join(__dirname, '../tests/grading/canvasParity.fixtures.js'));
  const cp23 = ALL_CANVAS_PARITY_SCENARIOS.find((f) => f().id === 'cp23')();

  for (const scenario of [case1FromFixtures(), cp23]) {
    const sid = scenario.studentId;
    const args = [sid, scenario.course, scenario.assignments, scenario.grades, scenario.submissions];

    const cjsCurrent = shared.calculateCurrentGradeWithWeightedGroups(...args);
    const esmCurrent = esm.calculateCurrentGradeWithWeightedGroups(...args);
    if (Math.abs(cjsCurrent - esmCurrent) > 0.0001) {
      console.error(`ESM current drift (${scenario.id}): cjs=${cjsCurrent} esm=${esmCurrent}`);
      failed = true;
    }

    const cjsFinal = shared.calculateProjectedFinalGradeWithWeightedGroups(...args);
    const esmFinal = esm.calculateProjectedFinalGradeWithWeightedGroups(...args);
    if (Math.abs(cjsFinal - esmFinal) > 0.0001) {
      console.error(`ESM final drift (${scenario.id}): cjs=${cjsFinal} esm=${esmFinal}`);
      failed = true;
    }
  }
}

function case1FromFixtures() {
  const { case1StandardWeighted } = require(path.join(__dirname, '../tests/grading/fixtures.js'));
  return case1StandardWeighted();
}

verifyEsmParity()
  .then(() => {
    if (failed) {
      process.exit(1);
    }
    console.log('Shared grading modules verified (exports + Case 1 + CJS/ESM twin parity).');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
