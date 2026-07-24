const express = require('express');
const request = require('supertest');
const { mongoSanitize, sanitizeValue } = require('../../../middleware/mongoSanitize');

describe('middleware/mongoSanitize', () => {
  test('sanitizeValue strips $ and dotted keys recursively', () => {
    const input = {
      email: 'a@b.com',
      $gt: '',
      'profile.name': 'x',
      nested: {
        ok: true,
        $ne: null,
        deeper: [{ score: 1, $where: '1==1' }],
      },
    };

    const out = sanitizeValue(input);
    expect(out).toEqual({
      email: 'a@b.com',
      nested: {
        ok: true,
        deeper: [{ score: 1 }],
      },
    });
  });

  test('sanitizeValue leaves legitimate dotted values alone', () => {
    expect(sanitizeValue({ version: '1.2.3', note: 'a.b.c' })).toEqual({
      version: '1.2.3',
      note: 'a.b.c',
    });
  });

  test('mongoSanitize mutates body, query, and params before next', async () => {
    const app = express();
    app.use(express.json());
    app.use(mongoSanitize);
    app.post('/echo/:id', (req, res) => {
      res.status(200).json({
        body: req.body,
        query: req.query,
        params: req.params,
      });
    });

    const res = await request(app)
      .post('/echo/abc?$ne=1&role=student')
      .send({ title: 'ok', $or: [{ a: 1 }], 'meta.flag': true });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ title: 'ok' });
    expect(res.body.query).toEqual({ role: 'student' });
    expect(res.body.params).toEqual({ id: 'abc' });
  });
});
