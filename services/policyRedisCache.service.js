const { getCacheService } = require('./cache');
const { isRedisConfigured } = require('../utils/bullmqConnection');

const TTL_SEC = parseInt(process.env.POLICY_CACHE_TTL_SEC || '300', 10);
const PREFIX = 'grading:policy:resolved:';

function cacheKey(courseId) {
  return `${PREFIX}${courseId}`;
}

async function getCachedResolvedPolicy(courseId) {
  if (!courseId) return null;
  return getCacheService().getJson(cacheKey(courseId));
}

async function setCachedResolvedPolicy(courseId, resolved) {
  if (!courseId || !resolved) return;
  await getCacheService().setJson(cacheKey(courseId), resolved, TTL_SEC);
}

async function invalidateCoursePolicyCache(courseId) {
  if (!courseId) return;
  await getCacheService().del(cacheKey(courseId));
}

async function invalidateInstitutionPolicyCache() {
  const keys = await getCacheService().keys(`${PREFIX}*`);
  for (const key of keys) {
    await getCacheService().del(key);
  }
}

module.exports = {
  getCachedResolvedPolicy,
  setCachedResolvedPolicy,
  invalidateCoursePolicyCache,
  invalidateInstitutionPolicyCache,
  isEnabled: isRedisConfigured,
};
