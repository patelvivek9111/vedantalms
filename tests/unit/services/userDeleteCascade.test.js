const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');
const User = require('../../../models/user.model');
const TranscriptIssueLog = require('../../../models/transcriptIssueLog.model');
const { deleteUserAndRelatedData } = require('../../../services/userDeleteCascade.service');

describe('userDeleteCascade.service', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), TranscriptIssueLog.collection.deleteMany({})]);
  });

  it('deletes a student even when append-only transcript issue logs exist', async () => {
    const student = await User.create({
      firstName: 'Maya',
      lastName: 'Patel',
      email: `maya-del-${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'student',
    });
    const issuer = await User.create({
      firstName: 'Reg',
      lastName: 'Istrar',
      email: `reg-del-${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'registrar',
    });

    await TranscriptIssueLog.collection.insertOne({
      student: student._id,
      term: 'Fall',
      year: 2026,
      issuedBy: issuer._id,
      transcriptHash: 'abc123',
      courseCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(TranscriptIssueLog.deleteMany({ student: student._id })).rejects.toThrow(
      /Append-only/
    );

    const result = await deleteUserAndRelatedData(student._id);
    expect(result.ok).toBe(true);
    expect(result.deleted.transcriptLogs).toBe(1);
    expect(await User.findById(student._id)).toBeNull();
    expect(await TranscriptIssueLog.collection.countDocuments({ student: student._id })).toBe(0);
  });
});
