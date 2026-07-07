/**
 * Shared helpers for Phase 7 comprehensive grading parity tests.
 */
const shared = require('../../shared/grading/index.cjs');
const backend = require('../../utils/gradeCalculation');
const { computeDualGradeTotals } = require('../../services/gradeCalculation.service');
const {
  resolveGradingPolicy,
  courseContextFromResolvedPolicy,
} = require('../../shared/grading/policyResolver.cjs');

function resolveScenarioContext(scenario) {
  let courseContext = scenario.course;
  let policy = scenario.policyOverride || null;

  if (scenario.policyOverride) {
    const resolved = resolveGradingPolicy({
      course: scenario.course,
      coursePolicy: { policy: scenario.policyOverride },
    });
    courseContext = courseContextFromResolvedPolicy(resolved);
    policy = resolved;
  }

  return { courseContext, policy };
}

function runCurrentGrade(scenario, calculator = shared.calculateCurrentGradeWithWeightedGroups) {
  const { courseContext, policy } = resolveScenarioContext(scenario);
  return calculator(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    scenario.submissions,
    policy
  );
}

function runFinalGrade(
  scenario,
  calculator = shared.calculateProjectedFinalGradeWithWeightedGroups
) {
  const { courseContext, policy } = resolveScenarioContext(scenario);
  return calculator(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    scenario.submissions,
    policy
  );
}

function runDualTotals(scenario) {
  const { courseContext, policy } = resolveScenarioContext(scenario);
  return computeDualGradeTotals(
    scenario.studentId,
    courseContext,
    scenario.assignments,
    scenario.grades,
    scenario.submissions,
    policy
  );
}

function assertClose(a, b, precision = 5) {
  expect(a).toBeCloseTo(b, precision);
}

module.exports = {
  shared,
  backend,
  computeDualGradeTotals,
  resolveScenarioContext,
  runCurrentGrade,
  runFinalGrade,
  runDualTotals,
  assertClose,
};
