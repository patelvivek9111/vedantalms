const { validationResult } = require('express-validator');
const { sendContactInquiry } = require('../utils/contactFormMail');
const ContactLead = require('../models/contactLead.model');

exports.postInquiry = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Please check the form and try again.',
        errors: errors.array({ onlyFirstError: true }),
      });
    }

    const { name, email, organization, jobTitle, userCount, extra } = req.body;

    const payload = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      organization: String(organization).trim(),
      jobTitle: String(jobTitle).trim(),
      userCount: String(userCount).trim(),
      extra: extra != null ? String(extra).trim() : '',
    };

    let lead = null;
    try {
      lead = await ContactLead.create({ ...payload, status: 'new' });
    } catch (leadErr) {
      console.error('Contact lead persist failed:', leadErr.message);
    }

    const result = await sendContactInquiry(payload);

    if (!result.ok) {
      const status = result.code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
      // Lead is still saved for platform provisioning even if mail fails
      if (lead && result.code === 'SMTP_NOT_CONFIGURED') {
        return res.status(200).json({
          ok: true,
          leadId: lead._id,
          message: 'Inquiry saved. Email delivery is not configured on this server.',
        });
      }
      return res.status(status).json({ message: result.message, leadId: lead?._id });
    }

    return res.status(200).json({ ok: true, leadId: lead?._id });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to submit inquiry' });
  }
};
