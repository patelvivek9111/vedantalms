const { validationResult } = require('express-validator');
const { sendContactInquiry } = require('../utils/contactFormMail');

exports.postInquiry = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Please check the form and try again.',
      errors: errors.array({ onlyFirstError: true }),
    });
  }

  const { name, organization, jobTitle, userCount, extra } = req.body;

  const result = await sendContactInquiry({
    name: String(name).trim(),
    organization: String(organization).trim(),
    jobTitle: String(jobTitle).trim(),
    userCount: String(userCount).trim(),
    extra: extra != null ? String(extra).trim() : '',
  });

  if (!result.ok) {
    const status = result.code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ message: result.message });
  }

  return res.status(200).json({ ok: true });
};
