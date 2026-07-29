const { validationResult, body } = require('express-validator');
const {
  claimStudentActivation,
  GENERIC_VERIFY_ERROR,
  GENERIC_SUCCESS,
} = require('../services/studentActivation.service');
const { rootAccountIdFromRequest } = require('../utils/tenantContext');

const claimValidators = [
  body('firstName').trim().notEmpty().withMessage('firstName is required'),
  body('lastName').trim().notEmpty().withMessage('lastName is required'),
  body('studentId').trim().notEmpty().withMessage('studentId is required'),
  body('personalEmail').isEmail().withMessage('personalEmail must be a valid email'),
  body('middleName').optional({ nullable: true }).isString(),
  // Honeypot — bots fill this; humans leave empty (hidden in UI).
  body('company').optional({ nullable: true }).isString(),
];

/**
 * POST /api/student-activation/claim
 * Public. Tenant resolved from Host. Enumeration-resistant responses.
 */
async function claim(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Still avoid leaking which field failed beyond a generic verify message for PII fields;
    // malformed email / missing required fields get a simple 400.
    return res.status(400).json({
      success: false,
      message: GENERIC_VERIFY_ERROR,
      errors: errors.array().map((e) => ({ msg: e.msg, path: e.path })),
    });
  }

  try {
    const tenantId = rootAccountIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: GENERIC_VERIFY_ERROR });
    }

    const {
      firstName,
      middleName = '',
      lastName,
      studentId,
      personalEmail,
      company = '',
    } = req.body || {};

    const result = await claimStudentActivation({
      rootAccountId: tenantId,
      firstName,
      middleName,
      lastName,
      studentId,
      personalEmail,
      ip: req.ip,
      honeypot: company,
    });

    if (result.ok) {
      return res.status(200).json({ success: true, message: result.message || GENERIC_SUCCESS });
    }

    return res.status(400).json({
      success: false,
      message: result.message || GENERIC_VERIFY_ERROR,
    });
  } catch (err) {
    console.error('student activation claim error:', err.message);
    return res.status(400).json({ success: false, message: GENERIC_VERIFY_ERROR });
  }
}

module.exports = {
  claim,
  claimValidators,
};
