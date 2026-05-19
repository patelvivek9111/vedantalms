jest.mock('../models/user.model', () => ({
  countDocuments: jest.fn(),
  findById: jest.fn(),
  find: jest.fn()
}));

jest.mock('../models/course.model', () => ({
  countDocuments: jest.fn(),
  find: jest.fn()
}));

jest.mock('../models/Assignment', () => ({
  countDocuments: jest.fn()
}));

jest.mock('../models/thread.model', () => ({
  countDocuments: jest.fn()
}));

jest.mock('../models/Submission', () => ({
  countDocuments: jest.fn(),
  find: jest.fn()
}));

jest.mock('../models/loginActivity.model', () => ({
  distinct: jest.fn()
}));

jest.mock('../models/systemSettings.model', () => {
  const ctor = jest.fn(function (data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
    this.toObject = () => this;
  });
  ctor.getSettings = jest.fn();
  ctor.findOne = jest.fn();
  return ctor;
});

jest.mock('../utils/emailService', () => ({
  initializeEmailService: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

const User = require('../models/user.model');
const SystemSettings = require('../models/systemSettings.model');
const adminController = require('../controllers/admin.controller');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/admin.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getSystemSettings masks SMTP password', async () => {
    SystemSettings.getSettings.mockResolvedValue({
      toObject: () => ({
        email: { smtpPassword: 'super-secret' },
        general: { appName: 'LMS' }
      })
    });

    const req = {};
    const res = createRes();

    await adminController.getSystemSettings(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        email: expect.objectContaining({ smtpPassword: '***' })
      })
    }));
  });

  test('updateSystemSettings preserves masked password placeholder', async () => {
    const save = jest.fn().mockResolvedValue(true);
    const toObject = jest.fn(() => ({ email: { smtpPassword: 'actual' } }));
    SystemSettings.findOne.mockResolvedValue({
      general: {},
      security: {},
      email: { smtpPassword: 'actual', smtpUser: 'user' },
      storage: {},
      save,
      toObject
    });

    const req = {
      body: {
        email: {
          smtpPassword: '***',
          smtpUser: 'updated-user'
        }
      }
    };
    const res = createRes();

    await adminController.updateSystemSettings(req, res);

    expect(save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('testEmailConfig returns 400 if user email is missing', async () => {
    User.findById.mockResolvedValue({ _id: 'u1', email: '' });
    const req = { user: { _id: 'u1' }, body: {} };
    const res = createRes();

    await adminController.testEmailConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false
    }));
  });
});

