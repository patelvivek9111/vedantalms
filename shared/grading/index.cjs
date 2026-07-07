const gradeCalculation = require('./gradeCalculation.cjs');
const groupActivation = require('./groupActivation.cjs');
const gradeStatus = require('./gradeStatus.cjs');
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
const extraCredit = require('./extraCredit.cjs');
const gradingEngineVersion = require('./gradingEngineVersion.cjs');
const transcriptHash = require('./transcriptHash.cjs');
const dropLowest = require('./dropLowest.cjs');
const dropHighest = require('./dropHighest.cjs');
const dropRules = require('./dropRules.cjs');
const policyApplication = require('./policyApplication.cjs');

module.exports = {
  ...gradeCalculation,
  ...groupActivation,
  ...gradeStatus,
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
  ...extraCredit,
  ...gradingEngineVersion,
  ...transcriptHash,
  ...dropLowest,
  ...dropHighest,
  ...dropRules,
  ...policyApplication,
};
