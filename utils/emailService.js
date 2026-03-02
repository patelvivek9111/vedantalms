const nodemailer = require('nodemailer');
const SystemSettings = require('../models/systemSettings.model');

let transporter = null;

// Initialize email transporter
async function initializeEmailService() {
  try {
    const settings = await SystemSettings.getSettings();
    const emailConfig = settings.email;

    // Check if email is configured
    if (!emailConfig.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPassword) {
      console.log('Email service not configured. Skipping email initialization.');
      return false;
    }

    transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort || 587,
      secure: emailConfig.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword
      },
      tls: {
        // Do not fail on invalid certificates (useful for self-signed certs)
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ Email service initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Email service initialization failed:', error.message);
    transporter = null;
    return false;
  }
}

// Send email
async function sendEmail(to, subject, html, text = null) {
  try {
    console.log(`📧 EMAIL SERVICE: Attempting to send email to: ${to}`);
    console.log(`📧 EMAIL SERVICE: Subject: ${subject}`);
    
    if (!transporter) {
      console.log(`📧 EMAIL SERVICE: Transporter not initialized, attempting to initialize...`);
      const initialized = await initializeEmailService();
      if (!initialized) {
        console.log('❌ EMAIL SERVICE: Email service not available. Email not sent.');
        return { success: false, error: 'Email service not configured' };
      }
    }

    const settings = await SystemSettings.getSettings();
    const emailConfig = settings.email;
    
    console.log(`📧 EMAIL SERVICE: SMTP Host: ${emailConfig.smtpHost || 'NOT SET'}`);
    console.log(`📧 EMAIL SERVICE: SMTP Port: ${emailConfig.smtpPort || 'NOT SET'}`);
    console.log(`📧 EMAIL SERVICE: SMTP User: ${emailConfig.smtpUser || 'NOT SET'}`);
    console.log(`📧 EMAIL SERVICE: From Email: ${emailConfig.fromEmail || emailConfig.smtpUser || 'NOT SET'}`);
    console.log(`📧 EMAIL SERVICE: From Name: ${emailConfig.fromName || 'LMS'}`);

    const mailOptions = {
      from: `"${emailConfig.fromName || 'LMS'}" <${emailConfig.fromEmail || emailConfig.smtpUser}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    console.log(`📧 EMAIL SERVICE: Sending email...`);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ EMAIL SERVICE: Email sent successfully!');
    console.log('✅ EMAIL SERVICE: Message ID:', info.messageId);
    console.log('✅ EMAIL SERVICE: Response:', info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ EMAIL SERVICE: Error sending email:', error.message);
    console.error('❌ EMAIL SERVICE: Error code:', error.code);
    console.error('❌ EMAIL SERVICE: Error command:', error.command);
    if (error.response) {
      console.error('❌ EMAIL SERVICE: Error response:', error.response);
    }
    return { success: false, error: error.message };
  }
}

// Send notification email
async function sendNotificationEmail(userEmail, notification) {
  try {
    const settings = await SystemSettings.getSettings();
    const siteName = settings.general?.siteName || 'LMS';

    const subject = `${siteName} - ${notification.title}`;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${siteName}</h2>
          </div>
          <div class="content">
            <h3>${notification.title}</h3>
            <p>${notification.message}</p>
            ${notification.link ? `<a href="${notification.link}" class="button">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>This is an automated notification from ${siteName}.</p>
            <p>You can manage your notification preferences in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail(userEmail, subject, html);
  } catch (error) {
    console.error('Error sending notification email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeEmailService,
  sendEmail,
  sendNotificationEmail
};

