const {
  checkEnrollmentRules,
  canOverrideRules,
} = require('./enrollmentRules.service');
const { activateEnrollment } = require('./enrollmentWrite.service');

const DEFAULT_ASYNC_THRESHOLD = 100;

/**
 * Apply resolved enrollment pairs (studentId + course docs already loaded).
 * Used by sync bulk enroll and the enrollment.bulk_csv job worker.
 */
async function runBulkEnrollmentPairs({
  pairs,
  user,
  override = false,
  overrideReason = '',
  enrollmentType = 'regular',
  onProgress = null,
}) {
  const results = [];
  let completed = 0;
  for (const pair of pairs) {
    if (pair.resolveError) {
      results.push({
        studentId: pair.studentId || pair.studentRef,
        courseId: pair.course?._id || pair.courseRef,
        ok: false,
        message: pair.resolveError,
      });
      completed += 1;
      if (onProgress) await onProgress(completed, pairs.length);
      continue;
    }
    try {
      const rules = await checkEnrollmentRules({
        studentId: pair.studentId,
        course: pair.course,
        source: 'registrar',
      });
      const blocked = !rules.allowed;
      if (blocked) {
        const hard = rules.violations.filter((v) => !v.overrideable);
        const already = rules.violations.some((v) => v.code === 'already_enrolled');
        if (already) {
          results.push({
            studentId: pair.studentId,
            courseId: pair.course._id,
            ok: true,
            skipped: true,
            message: 'Already enrolled',
            rules,
          });
          completed += 1;
          if (onProgress) await onProgress(completed, pairs.length);
          continue;
        }
        if (hard.length || !override || !canOverrideRules(user, rules)) {
          results.push({
            studentId: pair.studentId,
            courseId: pair.course._id,
            ok: false,
            message: rules.violations.map((v) => v.message).join('; ') || 'Rules blocked enrollment',
            rules,
          });
          completed += 1;
          if (onProgress) await onProgress(completed, pairs.length);
          continue;
        }
      }

      const enrollment = await activateEnrollment({
        course: pair.course,
        studentId: pair.studentId,
        actorId: user._id,
        source: 'registrar',
        enrollmentType: enrollmentType || 'regular',
      });
      results.push({
        studentId: pair.studentId,
        courseId: pair.course._id,
        ok: true,
        enrollmentId: enrollment._id,
        overridden: Boolean(override && blocked),
        overrideReason: override ? overrideReason : undefined,
        rules,
      });
    } catch (err) {
      results.push({
        studentId: pair.studentId,
        courseId: pair.course?._id,
        ok: false,
        message: err.message,
      });
    }
    completed += 1;
    if (onProgress) await onProgress(completed, pairs.length);
  }

  return {
    enrolled: results.filter((r) => r.ok && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

function shouldUseAsyncBulk(pairCount, asyncFlag) {
  const threshold = Number(process.env.ENROLLMENT_BULK_ASYNC_THRESHOLD || DEFAULT_ASYNC_THRESHOLD);
  if (asyncFlag === true) return true;
  if (asyncFlag === false) return false;
  return pairCount > threshold;
}

module.exports = {
  runBulkEnrollmentPairs,
  shouldUseAsyncBulk,
  DEFAULT_ASYNC_THRESHOLD,
};
