const gradeCalculation = require('./gradeCalculation.cjs');
const gradeValues = require('./gradeValues.cjs');
const gradebookCell = require('./gradebookCell.cjs');
const constants = require('./constants.cjs');
const policyDefaults = require('./policyDefaults.cjs');
const policyResolver = require('./policyResolver.cjs');
const policyValidation = require('./policyValidation.cjs');
const gpaScale = require('./gpaScale.cjs');
const latePenalty = require('./latePenalty.cjs');
const policySnapshot = require('./policySnapshot.cjs');
const policyDiff = require('./policyDiff.cjs');
const gradingEngineVersion = require('./gradingEngineVersion.cjs');
const transcriptHash = require('./transcriptHash.cjs');

module.exports = {
  ...gradeCalculation,
  ...gradeValues,
  ...gradebookCell,
  ...constants,
  ...policyDefaults,
  ...policyResolver,
  ...policyValidation,
  ...gpaScale,
  ...latePenalty,
  ...policySnapshot,
  ...policyDiff,
  ...gradingEngineVersion,
  ...transcriptHash,
};
