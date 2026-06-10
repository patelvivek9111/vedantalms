const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Module = require('../../models/module.model');
const Group = require('../../models/Group');

function indexKeySig(keys) {
  return JSON.stringify(keys);
}

function collectionHasIndex(collectionIndexes, expectedKeys) {
  const want = indexKeySig(expectedKeys);
  return collectionIndexes.some((idx) => indexKeySig(idx.key) === want);
}

describe('Phase 11C planner scale indexes', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
    await Module.syncIndexes();
    await Group.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('Module has { course: 1, published: 1 } index', async () => {
    const indexes = await Module.collection.indexes();
    expect(collectionHasIndex(indexes, { course: 1, published: 1 })).toBe(true);
  });

  it('Group has { members: 1, course: 1 } index', async () => {
    const indexes = await Group.collection.indexes();
    expect(collectionHasIndex(indexes, { members: 1, course: 1 })).toBe(true);
  });
});
