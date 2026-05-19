const mongoose = require('mongoose');

/**
 * ID remapping for cross-environment restores (Phase R2).
 */
class IdRemapper {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.map = new Map();
  }

  remember(oldId, newId) {
    if (!oldId) return newId;
    const key = String(oldId);
    this.map.set(key, String(newId));
    return newId;
  }

  lookup(oldId) {
    if (!oldId) return oldId;
    const key = String(oldId);
    if (this.enabled && this.map.has(key)) return this.map.get(key);
    return key;
  }

  remapValue(value) {
    if (value == null) return value;
    if (mongoose.Types.ObjectId.isValid(value) && String(value).length === 24) {
      const mapped = this.lookup(value);
      return mongoose.Types.ObjectId.isValid(mapped) ? new mongoose.Types.ObjectId(mapped) : mapped;
    }
    if (Array.isArray(value)) return value.map((v) => this.remapValue(v));
    return value;
  }

  remapDoc(doc, refFields = []) {
    if (!doc || typeof doc !== 'object') return doc;
    const out = { ...doc };
    if (this.enabled && out._id) {
      const oldId = String(out._id);
      if (!this.map.has(oldId)) {
        const newId = new mongoose.Types.ObjectId();
        this.remember(oldId, newId);
        out._id = newId;
      } else {
        out._id = new mongoose.Types.ObjectId(this.map.get(oldId));
      }
    }
    for (const field of refFields) {
      if (out[field]) out[field] = this.remapValue(out[field]);
    }
    if (this.enabled && out.migrationMeta) {
      out.migrationMeta = {
        ...out.migrationMeta,
        migratedFrom: out.migrationMeta.migratedFrom || String(out._id),
      };
    }
    return out;
  }

  toJSON() {
    return Object.fromEntries(this.map);
  }
}

module.exports = { IdRemapper };
