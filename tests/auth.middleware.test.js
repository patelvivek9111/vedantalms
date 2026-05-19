const express = require('express');
const request = require('supertest');

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

jest.mock('../models/user.model', () => ({
  findById: jest.fn()
}));

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { protect, authorize } = require('../middleware/auth');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middleware/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  });

  test('protect returns 401 when token is missing', async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('protect returns 401 when token verification fails', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });

    const req = { headers: { authorization: 'Bearer invalid' } };
    const res = createRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('protect attaches user and calls next on valid token', async () => {
    const fakeUser = { _id: 'u1', role: 'student' };
    jwt.verify.mockReturnValue({ id: 'u1' });
    User.findById.mockResolvedValue(fakeUser);

    const req = { headers: { authorization: 'Bearer valid' } };
    const res = createRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(req.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalled();
  });

  test('authorize enforces role matrix on routes', async () => {
    const app = express();
    app.use(express.json());

    app.get('/admin-only', (req, _res, next) => {
      req.user = { _id: '1', role: 'teacher' };
      next();
    }, authorize('admin'), (_req, res) => res.status(200).json({ ok: true }));

    app.get('/teacher-or-admin', (req, _res, next) => {
      req.user = { _id: '2', role: 'teacher' };
      next();
    }, authorize(['teacher', 'admin']), (_req, res) => res.status(200).json({ ok: true }));

    app.get('/student-only', (req, _res, next) => {
      req.user = { _id: '3', role: 'student' };
      next();
    }, authorize('student'), (_req, res) => res.status(200).json({ ok: true }));

    const adminDenied = await request(app).get('/admin-only');
    const teacherAllowed = await request(app).get('/teacher-or-admin');
    const studentAllowed = await request(app).get('/student-only');

    expect(adminDenied.status).toBe(403);
    expect(teacherAllowed.status).toBe(200);
    expect(studentAllowed.status).toBe(200);
  });
});

