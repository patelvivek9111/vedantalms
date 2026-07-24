/**
 * Board submit — export_only vs partner webhook dry-run.
 */
process.env.BOARD_SUBMIT_MODE = 'export_only';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let boardSubmit;
let Account;

describe('boardSubmit.service', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    boardSubmit = require('../../../services/registrar/boardSubmit.service');
    Account = require('../../../models/account.model');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('export_only skips partner HTTP and returns message', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    await Account.create({
      _id: tenantId,
      name: 'Test Inst',
      code: 'T1',
      rootAccountId: tenantId,
    }).catch(async () => {
      // Account schema may differ — create minimal if needed
    });

    // udise-extract should work without student
    const indiaReports = require('../../../services/registrar/indiaReports.service');
    jest.spyOn(indiaReports, 'runIndiaReport').mockResolvedValue({
      label: 'UDISE extract',
      rows: [{ a: 1 }],
      csvText: 'a\n1',
    });

    const result = await boardSubmit.submitIndiaReport({
      tenantId,
      kind: 'udise-extract',
      params: {},
    });
    expect(result.submitted).toBe(false);
    expect(result.mode).toBe('export_only');
    expect(result.message).toMatch(/export-only|partner/i);
  });

  it('getBoardHealth reflects partner mode when configured', () => {
    process.env.BOARD_SUBMIT_MODE = 'partner_webhook';
    process.env.BOARD_PARTNER_WEBHOOK_URL = 'https://partner.test/submit';
    const health = boardSubmit.getBoardHealth();
    expect(health.canSubmit).toBe(true);
    process.env.BOARD_SUBMIT_MODE = 'export_only';
    delete process.env.BOARD_PARTNER_WEBHOOK_URL;
  });
});
