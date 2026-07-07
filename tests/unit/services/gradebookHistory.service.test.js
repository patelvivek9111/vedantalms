jest.mock('../../../models/gradebookCellHistory.model', () => ({
  aggregate: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
}));

const mongoose = require('mongoose');
const GradebookCellHistory = require('../../../models/gradebookCellHistory.model');
const {
  batchCellsWithHistory,
  cellHistoryKey,
} = require('../../../services/gradebookHistory.service');

describe('gradebookHistory.service batchCellsWithHistory', () => {
  const courseId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const assignmentId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns keys for cells with history rows', async () => {
    GradebookCellHistory.aggregate.mockResolvedValue([
      { _id: { student: studentId, assignment: assignmentId } },
    ]);

    const cells = await batchCellsWithHistory(courseId, [studentId], [assignmentId]);
    expect(cells.has(cellHistoryKey(studentId, assignmentId))).toBe(true);
  });

  it('returns empty set when no students or assignments', async () => {
    const cells = await batchCellsWithHistory(courseId, [], [assignmentId]);
    expect(cells.size).toBe(0);
    expect(GradebookCellHistory.aggregate).not.toHaveBeenCalled();
  });
});
