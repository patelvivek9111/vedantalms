/**
 * LTI AGS unit tests — token + line item + score path with mocked fetch.
 */
process.env.LTI_AGS_ENABLED = 'true';
process.env.LTI_ISSUER = 'https://platform.test';
process.env.LTI_CLIENT_ID = 'client-1';
process.env.LTI_CLIENT_SECRET = 'secret-1';
process.env.LTI_DEPLOYMENT_ID = 'dep-1';
process.env.LTI_AGS_TOKEN_URL = 'https://platform.test/oauth/token';
process.env.LTI_AGS_LINEITEMS_URL = 'https://platform.test/api/lineitems';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let ltiAgs;
let GradePassbackRecord;

describe('ltiAgs.service', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    ltiAgs = require('../../../services/lti/ltiAgs.service');
    GradePassbackRecord = require('../../../models/gradePassbackRecord.model');
    ltiAgs.clearTokenCache();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(() => {
    ltiAgs.clearTokenCache();
    jest.restoreAllMocks();
  });

  it('reports platform ready when env is complete', () => {
    const ready = ltiAgs.getAgsReadiness();
    expect(ready.agsEnabled).toBe(true);
    expect(ready.platformReady).toBe(true);
    expect(ready.missing).toEqual([]);
  });

  it('dry-run submit creates preview GradePassbackRecord without HTTP', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const result = await ltiAgs.submitScores({
      tenantId,
      term: 'Fall',
      year: 2026,
      dryRun: true,
      rows: [{ email: 'a@test.edu', final_percent: 95, final_grade: 'A' }],
    });
    expect(result.stub).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.status).toBe('preview');
    const rec = await GradePassbackRecord.findById(result.recordId);
    expect(rec.channel).toBe('lti_ags');
  });

  it('live submit posts token + scores when fetch succeeds', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const fetchMock = jest.fn(async (url, opts) => {
      const u = String(url);
      if (u.includes('/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
        };
      }
      if (opts?.method === 'POST' && u.includes('/scores')) {
        return { ok: true, status: 200, text: async () => '{}' };
      }
      // line item create
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({ id: 'https://platform.test/api/lineitems/li-1' }),
      };
    });
    global.fetch = fetchMock;

    const result = await ltiAgs.submitScores({
      tenantId,
      term: 'Fall',
      year: 2026,
      dryRun: false,
      courseId: new mongoose.Types.ObjectId(),
      rows: [
        {
          email: 'stu@test.edu',
          final_percent: 88,
          final_grade: 'B+',
          lti_user_id: 'user-sub-1',
        },
      ],
    });

    expect(result.stub).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.scores?.submitted).toBe(1);
    expect(result.status).toBe('sent');
    expect(fetchMock).toHaveBeenCalled();
  });
});
