const {
  mapFieldToObject,
  serializeMongooseDoc,
} = require('./mongooseSerialize');

const SUBMISSION_MAP_FIELDS = ['answers', 'questionGrades', 'autoQuestionGrades'];

/**
 * Convert a Submission mongoose document (or plain object) into a JSON-safe payload.
 * Mongoose 8 Map fields are empty in toObject() unless flattenMaps is enabled.
 */
function serializeSubmissionForApi(submission) {
  return serializeMongooseDoc(submission, { extraMapFields: SUBMISSION_MAP_FIELDS });
}

module.exports = {
  SUBMISSION_MAP_FIELDS,
  mapFieldToObject,
  serializeSubmissionForApi,
};
