/**
 * Canvas-style weighted grading-period rollup.
 * When periods carry weights, the course total is a weighted average of each period's grade.
 */
const CourseGradingPeriod = require('../models/courseGradingPeriod.model');
const { getLetterGrade } = require('../utils/gradeCalculation');
const { sortPeriodsChronologically } = require('./gradingPeriodAssignment.service');

function periodsHaveWeights(periods) {
  return (
    Array.isArray(periods) &&
    periods.some((p) => p.weight != null && Number(p.weight) > 0)
  );
}

/**
 * @param {Array} periods
 * @returns {boolean} true when weights are configured and sum to ~100 (or any positive total)
 */
function shouldUseWeightedRollup(periods) {
  return periodsHaveWeights(periods);
}

/**
 * Compute weighted current/final % across grading periods for one student.
 * @param {object} course plain course doc
 * @param {string} studentId
 * @param {Function} computePeriodGrade async (periodId) => grade result with currentPercent/finalPercent
 * @param {Array} periods sorted chronologically
 */
async function rollupWeightedPeriodGrades(course, studentId, periods, computePeriodGrade) {
  const sorted = sortPeriodsChronologically(periods);
  const breakdown = [];

  for (const period of sorted) {
    const weight = period.weight != null ? Number(period.weight) : 0;
    if (!(weight > 0)) continue;

    const periodResult = await computePeriodGrade(String(period._id));
    const hasWork = Array.isArray(periodResult.allAssignments) && periodResult.allAssignments.length > 0;
    if (!hasWork) continue;

    breakdown.push({
      periodId: String(period._id),
      periodName: period.name,
      weight,
      currentPercent: periodResult.currentPercent,
      finalPercent: periodResult.finalPercent,
      letterGrade: periodResult.letterGrade,
      finalLetterGrade: periodResult.finalLetterGrade,
    });
  }

  const totalWeight = breakdown.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  let currentSum = 0;
  let finalSum = 0;
  let currentWeight = 0;
  let finalWeight = 0;

  for (const row of breakdown) {
    if (Number.isFinite(row.currentPercent)) {
      currentSum += row.currentPercent * row.weight;
      currentWeight += row.weight;
    }
    if (Number.isFinite(row.finalPercent)) {
      finalSum += row.finalPercent * row.weight;
      finalWeight += row.weight;
    }
  }

  const gradeScale = course.gradeScale || [];
  const currentPercent =
    currentWeight > 0 ? Math.round((currentSum / currentWeight) * 100) / 100 : null;
  const finalPercent =
    finalWeight > 0 ? Math.round((finalSum / finalWeight) * 100) / 100 : null;

  return {
    currentPercent,
    finalPercent,
    totalPercent: currentPercent,
    letterGrade:
      currentPercent != null ? getLetterGrade(currentPercent, gradeScale) : null,
    finalLetterGrade:
      finalPercent != null ? getLetterGrade(finalPercent, gradeScale) : null,
    gradingPeriodBreakdown: breakdown,
    totalWeight,
  };
}

async function listCoursePeriods(courseId) {
  return CourseGradingPeriod.find({ course: courseId })
    .sort({ position: 1, createdAt: 1 })
    .lean();
}

module.exports = {
  periodsHaveWeights,
  shouldUseWeightedRollup,
  rollupWeightedPeriodGrades,
  listCoursePeriods,
};
