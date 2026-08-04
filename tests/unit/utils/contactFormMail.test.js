/**
 * @jest-environment node
 */

const mockCreateTransport = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: (...args) => mockCreateTransport(...args),
}));

jest.mock('../../../models/systemSettings.model', () => ({
  getSettings: jest.fn(),
}));

const SystemSettings = require('../../../models/systemSettings.model');
const { sendContactInquiry, RESEND_API_URL } = require('../../../utils/contactFormMail');

const basePayload = {
  name: 'Vivek Patel',
  email: 'vivek@example.com',
  organization: 'MySl8te High',
  jobTitle: 'Registrar',
  userCount: '200',
  extra: 'Need SIS import',
};

describe('contactFormMail Resend HTTPS path', () => {
  const originalEnv = process.env;
  let fetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTACT_RESEND_API_KEY;
    delete process.env.CONTACT_RESEND_FROM;
    delete process.env.RESEND_FROM;
    delete process.env.CONTACT_SMTP_HOST;
    delete process.env.CONTACT_SMTP_USER;
    delete process.env.CONTACT_SMTP_PASS;
    delete process.env.CONTACT_SMTP_FROM;
    delete process.env.CONTACT_SMTP_FALLBACK;
    SystemSettings.getSettings.mockResolvedValue({ email: {} });
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends via Resend HTTPS when API key + from are set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CONTACT_RESEND_FROM = 'info@mysl8te.com';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_123' }),
    });

    const result = await sendContactInquiry(basePayload);

    expect(result).toEqual({ ok: true, messageId: 'msg_123' });
    expect(fetchMock).toHaveBeenCalledWith(
      RESEND_API_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toEqual(['info@mysl8te.com']);
    expect(body.reply_to).toBe('vivek@example.com');
    expect(body.from).toContain('info@mysl8te.com');
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('does not fall back to SMTP when Resend is configured (avoids Render free hang)', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CONTACT_RESEND_FROM = 'info@mysl8te.com';
    process.env.CONTACT_SMTP_HOST = 'smtp.zoho.com';
    process.env.CONTACT_SMTP_USER = 'info@mysl8te.com';
    process.env.CONTACT_SMTP_PASS = 'secret';
    process.env.CONTACT_SMTP_FROM = 'info@mysl8te.com';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid API key' }),
    });

    const result = await sendContactInquiry(basePayload);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('SEND_FAILED');
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('returns SMTP_NOT_CONFIGURED when neither Resend nor SMTP is set', async () => {
    const result = await sendContactInquiry(basePayload);
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'SMTP_NOT_CONFIGURED',
        message: expect.stringMatching(/RESEND_API_KEY/i),
      })
    );
  });
});
