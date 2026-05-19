const path = require('path');
const shared = require(path.join(__dirname, '../../shared/grading/index.cjs'));
const backend = require('../../utils/gradeCalculation');

describe('Shared grading source of truth', () => {
  it('backend re-exports match shared calculateFinalGradeWithWeightedGroups', () => {
    expect(backend.calculateFinalGradeWithWeightedGroups).toBe(
      shared.calculateFinalGradeWithWeightedGroups
    );
  });

  it('backend re-exports match shared getGradebookCellForExport', () => {
    expect(backend.getGradebookCellForExport).toBe(shared.getGradebookCellForExport);
  });
});
