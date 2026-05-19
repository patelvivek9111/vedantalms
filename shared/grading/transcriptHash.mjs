import { createHash } from 'crypto';
import { stableStringifyPolicy } from './policySnapshot.mjs';

export function hashTranscriptPayload(payload) {
  const raw = payload || {};
  const normalized = {
    studentId: raw.studentId,
    term: raw.term,
    year: raw.year,
    courses: Array.isArray(raw.courses)
      ? [...raw.courses]
          .map((row) => ({
            courseId: row.courseId,
            finalPercent: row.finalPercent,
            letterGrade: row.letterGrade,
            gradingPolicyHash: row.gradingPolicyHash,
            gradingPolicyVersion: row.gradingPolicyVersion,
            gradingEngineVersion: row.gradingEngineVersion,
            lifecycleStatus: row.lifecycleStatus,
          }))
          .sort((a, b) => String(a.courseId).localeCompare(String(b.courseId)))
      : [],
  };
  const canonical = stableStringifyPolicy(normalized);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
