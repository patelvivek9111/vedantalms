const { validationResult } = require('express-validator');
const { sendContactInquiry } = require('../utils/contactFormMail');
const ContactLead = require('../models/contactLead.model');
const { CONTACT_INQUIRY_SEND_TIMEOUT_MS } = require('../utils/smtpTransportTimeouts');

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

    let timeoutId;
    const result = await Promise.race([
      sendContactInquiry(payload),
      new Promise((resolve) => {
        timeoutId = setTimeout(
          () =>
            resolve({
              ok: false,
              code: 'TIMEOUT',
              message: 'Email delivery timed out.',
            }),
          CONTACT_INQUIRY_SEND_TIMEOUT_MS
        );
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    if (!result.ok) {
      // Lead may still be saved for follow-up, but never claim the email was sent.
      if (lead && (result.code === 'SMTP_NOT_CONFIGURED' || result.code === 'TIMEOUT')) {
        const status = result.code === 'SMTP_NOT_CONFIGURED' ? 503 : 200;
        return res.status(status).json({
          ok: false,
          mailSent: false,
          leadId: lead._id,
          message:
            result.code === 'TIMEOUT'
              ? "We saved your inquiry, but email delivery timed out. We'll still follow up — or email info@mysl8te.com."
              : 'We saved your inquiry, but email is not configured on this server. Please email info@mysl8te.com directly.',
        });
      }
      const status = result.code === 'SMTP_NOT_CONFIGURED' ? 503 : 500;
      return res.status(status).json({
        ok: false,
        mailSent: false,
        message: result.message,
        leadId: lead?._id,
      });
    }

    return res.status(200).json({ ok: true, mailSent: true, leadId: lead?._id });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to submit inquiry' });
  }
};
