jest.mock('../../../utils/contactFormMail', () => ({
  sendContactInquiry: jest.fn(),
}));

jest.mock('../../../models/contactLead.model', () => ({
  create: jest.fn(),
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => [],
  })),
}));

const { sendContactInquiry } = require('../../../utils/contactFormMail');
const ContactLead = require('../../../models/contactLead.model');
const contactController = require('../../../controllers/contact.controller');
const { CONTACT_INQUIRY_SEND_TIMEOUT_MS } = require('../../../utils/smtpTransportTimeouts');

function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function validBody() {
  return {
    name: 'Vivek Patel',
    email: 'vivek@example.com',
    organization: 'MySl8te High',
    jobTitle: 'Registrar',
    userCount: '200',
    extra: 'Need SIS import',
  };
}

describe('contact.controller postInquiry timeouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 200 with mailSent:false when SMTP hang times out, and lead is still saved', async () => {
    const leadId = 'lead-timeout-1';
    ContactLead.create.mockResolvedValue({ _id: leadId, status: 'new' });
    sendContactInquiry.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves — hung SMTP */
        })
    );

    const res = createRes();
    const done = contactController.postInquiry({ body: validBody() }, res);

    await jest.advanceTimersByTimeAsync(CONTACT_INQUIRY_SEND_TIMEOUT_MS + 50);
    await done;

    expect(ContactLead.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        mailSent: false,
        leadId,
        message: expect.stringMatching(/timed out|follow up|info@mysl8te\.com/i),
      })
    );
  });

  it('bounds the hang to the configured ~12s timeout window', async () => {
    expect(CONTACT_INQUIRY_SEND_TIMEOUT_MS).toBe(12_000);
    ContactLead.create.mockResolvedValue({ _id: 'lead-2', status: 'new' });
    sendContactInquiry.mockImplementation(() => new Promise(() => {}));

    const res = createRes();
    const done = contactController.postInquiry({ body: validBody() }, res);

    // Still pending before timeout
    await jest.advanceTimersByTimeAsync(CONTACT_INQUIRY_SEND_TIMEOUT_MS - 1000);
    expect(res.status).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1500);
    await done;
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
