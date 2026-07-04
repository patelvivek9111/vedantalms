const path = require('path');
const {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  isCloudinaryConfigured,
  deleteFromCloudinary,
  extractPublicId,
  inferResourceTypeFromUrl,
} = require('../../utils/cloudinary');
const { LocalStorageAdapter } = require('./localStorageAdapter');

/**
 * Current cloud object storage (Cloudinary) with local fallback for dev.
 * Future S3/R2 adapters implement the same surface without controller changes.
 */
class CloudStorageAdapter {
  constructor() {
    this.name = 'cloudinary';
    this.localFallback = new LocalStorageAdapter();
  }

  isConfigured() {
    return isCloudinaryConfigured();
  }

  async uploadFile(file, options = {}) {
    if (!this.isConfigured()) {
      const rel = file.filename || path.basename(file.path || 'upload.bin');
      return this.localFallback.writeFile(rel, await require('fs').promises.readFile(file.path));
    }
    const result = await uploadToCloudinary(file, options);
    return {
      path: result.public_id,
      url: result.url,
      provider: this.name,
      metadata: result,
    };
  }

  async uploadMultiple(files, options = {}) {
    if (!this.isConfigured()) {
      return Promise.all(files.map((f) => this.uploadFile(f, options)));
    }
    const results = await uploadMultipleToCloudinary(files, options);
    return results.map((result, i) => ({
      path: result.public_id,
      url: result.url,
      provider: this.name,
      originalName: files[i]?.originalname,
    }));
  }

  async deleteByUrl(url, resourceType = 'auto') {
    if (url && url.includes('cloudinary.com')) {
      const publicId = extractPublicId(url);
      if (publicId) {
        const resolvedType =
          resourceType && resourceType !== 'auto'
            ? resourceType
            : inferResourceTypeFromUrl(url, 'image');
        await deleteFromCloudinary(publicId, resolvedType);
      }
    }
  }

  getCapabilities() {
    return {
      supportsSignedUrls: false,
      supportsStreamingExports: false,
      supportsVersioning: false,
      supportsLifecycleRules: false,
    };
  }
}

module.exports = { CloudStorageAdapter };
