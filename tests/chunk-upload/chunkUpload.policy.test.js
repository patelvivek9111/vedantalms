const chunkedUpload = require('../../services/chunkedUpload.service');
const { reconcileUploadSessions } = require('../../services/uploadRecovery.service');

describe('chunked upload policy', () => {
  test('default chunk size is 5MB', () => {
    expect(chunkedUpload.DEFAULT_CHUNK_SIZE).toBe(5 * 1024 * 1024);
  });

  test('saveChunk rejects non-binary chunk bodies', () => {
    expect(() => chunkedUpload.saveChunk('deadbeefdeadbeefdeadbeefdeadbeef', 0, {})).toThrow(
      /Invalid chunk payload/i
    );
  });

  test('reconcile upload sessions returns report shape', async () => {
    const report = await reconcileUploadSessions({ dryRun: true });
    expect(report).toHaveProperty('activeSessions');
    expect(report).toHaveProperty('orphanDirs');
    expect(report).toHaveProperty('ok');
  });
});
