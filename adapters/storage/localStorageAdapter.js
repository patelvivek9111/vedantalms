const fs = require('fs');
const path = require('path');
const { paths, isPathInside } = require('../../config/paths');

/**
 * Local filesystem storage (uploads, exports, archives).
 */
class LocalStorageAdapter {
  constructor(baseDir = paths.uploads) {
    this.name = 'local';
    this.baseDir = baseDir;
  }

  async ensureDir(relativeDir) {
    const dir = path.join(this.baseDir, relativeDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async writeFile(relativePath, content, options = {}) {
    const full = path.join(this.baseDir, relativePath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (Buffer.isBuffer(content) || typeof content === 'string') {
      fs.writeFileSync(full, content, options.encoding ? { encoding: options.encoding } : undefined);
    } else {
      fs.writeFileSync(full, JSON.stringify(content, null, 2));
    }
    return { path: full, url: `/uploads/${relativePath.replace(/\\/g, '/')}`, provider: this.name };
  }

  async readFile(relativePath) {
    const full = path.join(this.baseDir, relativePath);
    if (!isPathInside(this.baseDir, full)) {
      throw new Error('Path escapes storage root');
    }
    return fs.readFileSync(full);
  }

  resolvePath(relativePath) {
    return path.join(this.baseDir, relativePath);
  }

  /**
   * Store a Multer file under a relative academic path.
   */
  async uploadFile(file, options = {}) {
    const rel = options.relativePath || file.filename || `upload-${Date.now()}`;
    if (file.path && fs.existsSync(file.path)) {
      const dest = path.join(this.baseDir, rel);
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await fs.promises.rename(file.path, dest).catch(async () => {
        await fs.promises.copyFile(file.path, dest);
        await fs.promises.unlink(file.path).catch(() => {});
      });
      return {
        path: rel,
        url: `/uploads/${rel.replace(/\\/g, '/')}`,
        provider: this.name,
      };
    }
    if (file.buffer) {
      return this.writeFile(rel, file.buffer);
    }
    throw new Error('Unsupported upload file payload');
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

module.exports = { LocalStorageAdapter };
