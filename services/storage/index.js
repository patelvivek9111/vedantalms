const { resolveStorageProvider } = require('../../config/providers');
const { LocalStorageAdapter } = require('../../adapters/storage/localStorageAdapter');
const { CloudStorageAdapter } = require('../../adapters/storage/cloudStorageAdapter');
const { paths } = require('../../config/paths');

let storageInstance = null;

function createStorageAdapter(providerKey) {
  if (providerKey === 'cloudinary') return new CloudStorageAdapter();
  return new LocalStorageAdapter(paths.uploads);
}

function getStorageService() {
  if (!storageInstance) {
    const key = resolveStorageProvider();
    const adapter = createStorageAdapter(key);
    storageInstance = {
      provider: key,
      adapter,
      uploads: adapter,
      exports: new LocalStorageAdapter(paths.jobExports),
      archives: new LocalStorageAdapter(paths.gradeArchives),
      institutionExports: new LocalStorageAdapter(paths.institutionExports),
      getCapabilities: () => adapter.getCapabilities?.() || {},
    };
  }
  return storageInstance;
}

/** Clears cached adapters so JOB_EXPORTS_DIR / INSTITUTION_EXPORTS_DIR changes take effect. */
function resetStorageService() {
  storageInstance = null;
}

module.exports = {
  getStorageService,
  createStorageAdapter,
  resetStorageService,
};
