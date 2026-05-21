const mongoose = require('mongoose');
const { supersedeFileAssets, newVersionGroupId } = require('../../services/fileVersioning.service');

jest.mock('../../models/fileAsset.model', () => {
  const store = new Map();
  return {
    find: jest.fn(({ _id }) => ({
      lean: async () => [],
      then: undefined,
    })),
    findById: jest.fn(async (id) => store.get(String(id)) || null),
    findByIdAndUpdate: jest.fn(async (id, { $set }) => {
      const prev = store.get(String(id)) || { _id: id };
      const next = { ...prev, ...$set, _id: id };
      store.set(String(id), next);
      return next;
    }),
    __store: store,
  };
});

jest.mock('../../services/fileGovernance.service', () => ({
  recordFileReplacement: jest.fn().mockResolvedValue({}),
}));

const FileAsset = require('../../models/fileAsset.model');

describe('file versioning', () => {
  beforeEach(() => {
    FileAsset.__store.clear();
    FileAsset.find.mockImplementation((query) => {
      const ids = query?._id?.$in || [];
      return Promise.resolve(ids.map((id) => FileAsset.__store.get(String(id))).filter(Boolean));
    });
  });

  test('newVersionGroupId returns unique string', () => {
    expect(newVersionGroupId()).not.toBe(newVersionGroupId());
  });

  test('supersedeFileAssets marks previous non-current and bumps version', async () => {
    const oldId = new mongoose.Types.ObjectId();
    const newId = new mongoose.Types.ObjectId();
    const oldDoc = {
      _id: oldId,
      versionNumber: 1,
      isCurrentVersion: true,
      versionGroupId: 'vg_test',
      save: jest.fn(async function save() {
        FileAsset.__store.set(String(this._id), this);
        return this;
      }),
    };
    FileAsset.__store.set(String(oldId), oldDoc);

    const result = await supersedeFileAssets({
      previousAssetIds: [oldId],
      newAssetIds: [newId],
      patch: { category: 'submission' },
      audit: { userId: new mongoose.Types.ObjectId() },
    });

    expect(result.versionNumber).toBe(2);
    const old = FileAsset.__store.get(String(oldId));
    const neu = FileAsset.__store.get(String(newId));
    expect(old.isCurrentVersion).toBe(false);
    expect(neu.isCurrentVersion).toBe(true);
    expect(neu.versionNumber).toBe(2);
  });
});
