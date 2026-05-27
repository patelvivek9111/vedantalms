/**
 * Normalize Mongo-style ids for safe string comparison (e.g. thread.course vs route courseId).
 */
export function normalizeMongoIdRef(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const o = value as { _id?: unknown; $oid?: string };
    if (o._id != null) return String(o._id);
    if (typeof o.$oid === 'string') return o.$oid;
  }
  return String(value);
}
