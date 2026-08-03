/**
 * Shared nodemailer socket timeouts — keep contact + system mailers aligned.
 * Zoho from Render often needs >8s; attempt budget must exceed connection+greeting.
 */
const SMTP_CONNECTION_TIMEOUT_MS = 15_000;
const SMTP_GREETING_TIMEOUT_MS = 15_000;
const SMTP_SOCKET_TIMEOUT_MS = 25_000;

/** Upper bound for contact inquiry HTTP handler while waiting on sendContactInquiry. */
const CONTACT_INQUIRY_SEND_TIMEOUT_MS = 35_000;

/** Per-transport attempt; must be below CONTACT_INQUIRY_SEND_TIMEOUT_MS so fallback can run. */
const SMTP_ATTEMPT_TIMEOUT_MS = 20_000;

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
  SMTP_ATTEMPT_TIMEOUT_MS,
  smtpTransportTimeouts,
};
