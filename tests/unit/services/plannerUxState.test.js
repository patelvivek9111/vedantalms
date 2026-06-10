const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');
const PlannerItemState = require('../../../models/plannerItemState.model');
const {
  dismissPlannerItem,
  snoozePlannerItem,
  filterItemsByUxState,
  getActiveStateMapForUser,
} = require('../../../services/planner/plannerUxState.service');

describe('plannerUxState.service', () => {
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
    await PlannerItemState.deleteMany({});
  });

  it('filters dismissed items', async () => {
    const userId = new mongoose.Types.ObjectId();
    await dismissPlannerItem(userId, 'derived:assignment:1');

    const stateMap = await getActiveStateMapForUser(userId);
    const visible = filterItemsByUxState(
      [{ _id: '1', type: 'assignment' }, { _id: '2', type: 'assignment' }],
      stateMap
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]._id).toBe('2');
  });

  it('filters snoozed items until expiry', async () => {
    const userId = new mongoose.Types.ObjectId();
    await snoozePlannerItem(userId, 'derived:discussion:9', {
      until: new Date(Date.now() + 60 * 60 * 1000),
    });

    const stateMap = await getActiveStateMapForUser(userId);
    const visible = filterItemsByUxState([{ _id: '9', type: 'discussion' }], stateMap);
    expect(visible).toHaveLength(0);
  });
});
