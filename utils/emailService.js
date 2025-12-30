/**
 * Email Service
 * 
 * Handles email sending functionality using Nodemailer
 * Supports SMTP configuration from environment variables or system settings
 * 
 * Usage:
 *   const emailService = require('./utils/emailService');
 *   await emailService.sendEmail({
 *     to: 'user@example.com',
 *     subject: 'Welcome',
 *     html: '<h1>Welcome!</h1>'
 *   });
 */

const nodemailer = require('nodemailer');
const SystemSettings = require('../models/systemSettings.model');
const logger = require('./logger');

let transporter = null;
let isConfigured = false;

/**
 * Initialize email transporter
 * Checks for email configuration in environment variables or system settings
 */
async function initializeTransporter() {
  try {
    // First, try to get settings from environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    // If env vars are not set, try to get from system settings
    let emailConfig = null;
    if (!smtpHost || !smtpUser || !smtpPass) {
      try {
        const settings = await SystemSettings.findOne();
        if (settings && settings.email) {
          emailConfig = settings.email;
        }
      } catch (err) {
        logger.warn('Could not load email config from system settings', { error: err.message });
      }
    }

    // Use environment variables if available, otherwise use system settings
    const config = {
      host: smtpHost || emailConfig?.smtpHost,
      port: parseInt(smtpPort || emailConfig?.smtpPort || '587'),
      secure: (smtpPort || emailConfig?.smtpPort || '587') === '465', // true for 465, false for other ports
      auth: {
        user: smtpUser || emailConfig?.smtpUser,
        pass: smtpPass || emailConfig?.smtpPassword,
      },
      from: smtpFrom || emailConfig?.fromEmail || smtpUser || emailConfig?.smtpUser,
      fromName: emailConfig?.fromName || 'Vedanta LMS',
    };

    // Check if email is configured
    if (!config.host || !config.auth.user || !config.auth.pass) {
      isConfigured = false;
      logger.warn('Email service not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
      return false;
    }

    // Create transporter
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // For Gmail and similar services
      ...(config.host.includes('gmail') && {
        service: 'gmail',
      }),
    });

    // Verify connection
    await transporter.verify();
    isConfigured = true;
    logger.info('Email service initialized successfully', { host: config.host });
    return true;
  } catch (error) {
    isConfigured = false;
    logger.error('Failed to initialize email service', { error: error.message });
    return false;
  }
}

/**
 * Check if email service is configured
 */
function isEmailConfigured() {
  return isConfigured && transporter !== null;
}

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {string|string[]} options.cc - CC recipients (optional)
 * @param {string|string[]} options.bcc - BCC recipients (optional)
 * @param {Object} options.attachments - Email attachments (optional)
 * @returns {Promise<Object>} Send result
 */
async function sendEmail(options) {
  try {
    if (!isConfigured) {
      // Try to initialize if not already done
      const initialized = await initializeTransporter();
      if (!initialized) {
        throw new Error('Email service is not configured. Please configure SMTP settings.');
      }
    }

    if (!transporter) {
      throw new Error('Email transporter not initialized');
    }

    const { to, subject, html, text, cc, bcc, attachments } = options;

    if (!to || !subject || (!html && !text)) {
      throw new Error('Missing required email fields: to, subject, and html/text are required');
    }

    // Get from address
    let fromAddress = process.env.SMTP_FROM;
    let fromName = 'Vedanta LMS';
    
    if (!fromAddress) {
      try {
        const settings = await SystemSettings.findOne();
        if (settings?.email) {
          fromAddress = settings.email.fromEmail || settings.email.smtpUser;
          fromName = settings.email.fromName || 'Vedanta LMS';
        }
      } catch (err) {
        logger.warn('Could not load from address from settings', { error: err.message });
      }
    }
    
    if (!fromAddress) {
      fromAddress = process.env.SMTP_USER || 'noreply@vedantaed.com';
    }
    
    const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

    const mailOptions = {
      from: from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if text not provided
      ...(cc && { cc: Array.isArray(cc) ? cc.join(', ') : cc }),
      ...(bcc && { bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc }),
      ...(attachments && { attachments }),
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { 
      to: mailOptions.to, 
      subject: mailOptions.subject,
      messageId: result.messageId 
    });
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
    };
  } catch (error) {
    logger.error('Failed to send email', { 
      error: error.message,
      to: options.to,
      subject: options.subject 
    });
    throw error;
  }
}

/**
 * Send test email
 * @param {string} to - Recipient email
 * @returns {Promise<Object>} Send result
 */
async function sendTestEmail(to) {
  const testSubject = 'Vedanta LMS - Test Email';
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Vedanta LMS</h1>
        </div>
        <div class="content">
          <h2>Test Email</h2>
          <p>This is a test email from your Vedanta LMS system.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div class="footer">
          <p>This is an automated message from Vedanta LMS. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: to,
    subject: testSubject,
    html: testHtml,
  });
}

/**
 * Send welcome email to new user
 * @param {Object} user - User object
 * @param {string} temporaryPassword - Temporary password (if applicable)
 * @returns {Promise<Object>} Send result
 */
async function sendWelcomeEmail(user, temporaryPassword = null) {
  const subject = 'Welcome to Vedanta LMS';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Vedanta LMS</h1>
        </div>
        <div class="content">
          <p>Hello ${user.firstName || 'User'},</p>
          <p>Welcome to Vedanta Learning Management System! Your account has been created successfully.</p>
          ${temporaryPassword ? `
            <p><strong>Your temporary password is:</strong> ${temporaryPassword}</p>
            <p>Please change your password after your first login.</p>
          ` : ''}
          <p>You can now access the system and start learning!</p>
          <a href="${process.env.FRONTEND_URL || 'https://vedantaed.com'}/login" class="button">Login to LMS</a>
        </div>
        <div class="footer">
          <p>This is an automated message from Vedanta LMS. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: user.email,
    subject: subject,
    html: html,
  });
}

// Initialize on module load
initializeTransporter().catch(err => {
  logger.warn('Email service initialization deferred', { error: err.message });
});

module.exports = {
  sendEmail,
  sendTestEmail,
  sendWelcomeEmail,
  isEmailConfigured,
  initializeTransporter,
};

