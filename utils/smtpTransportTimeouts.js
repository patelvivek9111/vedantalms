/**
 * Shared nodemailer socket timeouts — keep contact + system mailers aligned.
 * Tune here if legitimate slow SMTP needs more headroom.
 */
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 15_000;

/** Upper bound for contact inquiry HTTP handler while waiting on sendContactInquiry. */
const CONTACT_INQUIRY_SEND_TIMEOUT_MS = 12_000;

function smtpTransportTimeouts() {
  return {
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  };
}

module.exports = {
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS,
  CONTACT_INQUIRY_SEND_TIMEOUT_MS,
  smtpTransportTimeouts,
};
