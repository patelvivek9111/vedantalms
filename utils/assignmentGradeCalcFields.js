/**
 * Assignment fields required by the shared grading engine (EC, points, publish state).
 */
function assignmentGradeCalcFields(assignment) {
  return {
    isExtraCredit: assignment.isExtraCredit === true,
    bonusPoints: assignment.bonusPoints,
  };
}

module.exports = {
  assignmentGradeCalcFields,
};
