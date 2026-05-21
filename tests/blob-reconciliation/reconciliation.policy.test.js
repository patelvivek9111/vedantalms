const { writeReport } = require('../../utils/fileReports');
const fs = require('fs');
const path = require('path');

describe('blob reconciliation reporting', () => {
  test('writeReport creates JSON under uploads/reports', () => {
    const p = writeReport('test-reconciliation-sample.json', { ok: true });
    expect(p).toContain('reports');
    expect(fs.existsSync(p)).toBe(true);
    fs.unlinkSync(p);
  });
});
