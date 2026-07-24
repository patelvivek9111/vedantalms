/**
 * ERP hold webhook HMAC + event apply.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ERP_HOLDS_WEBHOOK_SECRET = 'erp-test-secret';

let mongo;
let erp;
let User;
let ErpHoldWebhookEvent;

describe('erpHoldWebhook.service', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    erp = require('../../../services/integrations/erpHoldWebhook.service');
    User = require('../../../models/user.model');
    ErpHoldWebhookEvent = require('../../../models/erpHoldWebhookEvent.model');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('accepts HMAC signature over JSON body', () => {
    const body = { externalHoldId: 'H1', studentEmail: 'a@b.com', active: true };
    const raw = JSON.stringify(body);
    const hex = crypto.createHmac('sha256', 'erp-test-secret').update(raw).digest('hex');
    const req = {
      get: (h) => (h === 'x-erp-signature' ? `sha256=${hex}` : ''),
      body,
      rawBody: Buffer.from(raw),
    };
    const auth = erp.verifyErpAuth(req);
    expect(auth.ok).toBe(true);
    expect(auth.method).toBe('hmac');
  });

  it('rejects bad HMAC', () => {
    const req = {
      get: (h) => (h === 'x-erp-signature' ? 'sha256=deadbeef' : ''),
      body: { externalHoldId: 'H1' },
      rawBody: Buffer.from('{}'),
    };
    const auth = erp.verifyErpAuth(req);
    expect(auth.ok).toBe(false);
  });

  it('applies hold and records event', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    await User.create({
      firstName: 'Stu',
      lastName: 'Dent',
      email: 'erp-hold@test.edu',
      password: 'Password1!',
      role: 'student',
      rootAccountId: tenantId,
      accountId: tenantId,
    });

    const result = await erp.ingestAndProcess({
      tenantId,
      auth: { ok: true, method: 'hmac' },
      payload: {
        externalHoldId: 'ERP-P5-1',
        studentEmail: 'erp-hold@test.edu',
        holdType: 'financial',
        reason: 'Test',
        active: true,
        blocksTranscript: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe('upserted');
    expect(result.event.status).toBe('applied');
    const ev = await ErpHoldWebhookEvent.findById(result.event._id);
    expect(ev.signatureValid).toBe(true);
  });
});
