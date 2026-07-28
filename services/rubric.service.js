const crypto = require('crypto');
const Rubric = require('../models/rubric.model');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { withTenantFilter, rootAccountIdFromRequest } = require('../utils/tenantContext');

function newId(prefix = 'c') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeRatings(ratings = [], criterionPoints = 0) {
  const list = Array.isArray(ratings) ? ratings : [];
  if (!list.length) {
    return [
      { id: newId('r'), description: 'Full marks', points: Number(criterionPoints) || 0 },
      { id: newId('r'), description: 'No marks', points: 0 },
    ];
  }
  return list.map((r) => ({
    id: String(r.id || newId('r')),
    description: String(r.description || '').trim() || 'Rating',
    longDescription: String(r.longDescription || '').trim(),
    points: Math.max(0, Number(r.points) || 0),
  }));
}

function normalizeCriteria(criteria = []) {
  const list = Array.isArray(criteria) ? criteria : [];
  return list
    .map((c) => {
      const ratings = normalizeRatings(c.ratings, c.points);
      const maxFromRatings = ratings.reduce((m, r) => Math.max(m, r.points), 0);
      const points = Math.max(0, Number(c.points) || maxFromRatings || 0);
      return {
        id: String(c.id || newId('c')),
        description: String(c.description || '').trim(),
        longDescription: String(c.longDescription || '').trim(),
        points,
        ratings: ratings.sort((a, b) => b.points - a.points),
      };
    })
    .filter((c) => c.description);
}

function computePointsPossible(criteria = []) {
  return normalizeCriteria(criteria).reduce((sum, c) => sum + (Number(c.points) || 0), 0);
}

function toSnapshot(rubricDocOrPlain) {
  const plain =
    typeof rubricDocOrPlain?.toObject === 'function'
      ? rubricDocOrPlain.toObject()
      : rubricDocOrPlain || {};
  const criteria = normalizeCriteria(plain.criteria);
  return {
    title: String(plain.title || 'Rubric').trim() || 'Rubric',
    pointsPossible: computePointsPossible(criteria),
    freeFormCriterionComments: plain.freeFormCriterionComments !== false,
    criteria,
    rubricId: plain._id ? String(plain._id) : plain.rubricId || null,
    snapshottedAt: new Date().toISOString(),
  };
}

function emptyRubricDraft(title = 'Assignment rubric') {
  return {
    title,
    freeFormCriterionComments: true,
    criteria: [
      {
        id: newId('c'),
        description: 'Criterion 1',
        longDescription: '',
        points: 5,
        ratings: [
          { id: newId('r'), description: 'Full marks', points: 5 },
          { id: newId('r'), description: 'Partial', points: 3 },
          { id: newId('r'), description: 'No marks', points: 0 },
        ],
      },
    ],
  };
}

async function createRubric({ title, criteria, courseId, freeFormCriterionComments, user, req }) {
  const normalized = normalizeCriteria(criteria);
  if (!normalized.length) {
    const err = new Error('Rubric needs at least one criterion');
    err.status = 400;
    throw err;
  }
  const rootAccountId = rootAccountIdFromRequest(req) || user?.rootAccountId;
  const doc = await Rubric.create({
    title: String(title || 'Rubric').trim() || 'Rubric',
    courseId: courseId || null,
    criteria: normalized,
    pointsPossible: computePointsPossible(normalized),
    freeFormCriterionComments: freeFormCriterionComments !== false,
    createdBy: user._id,
    rootAccountId,
    accountId: rootAccountId,
    workflowState: 'active',
  });
  return doc;
}

async function updateRubric(rubricId, patch, { user, req, allowSharedEdit = false }) {
  const rootAccountId = rootAccountIdFromRequest(req) || user?.rootAccountId;
  const doc = await Rubric.findOne(
    withTenantFilter({ _id: rubricId, workflowState: { $ne: 'deleted' } }, rootAccountId)
  );
  if (!doc) {
    const err = new Error('Rubric not found');
    err.status = 404;
    throw err;
  }

  const changingDefinition =
    patch.title != null || patch.criteria != null || patch.freeFormCriterionComments != null;
  if (changingDefinition && !allowSharedEdit) {
    const associationCount = await countRubricAssociations(doc._id, rootAccountId);
    // Canvas: rubrics used in more than one place cannot be edited in place — copy instead.
    if (associationCount > 1) {
      const err = new Error(
        'This rubric is attached to multiple assignments. Make a copy to edit, or remove it from other assignments first.'
      );
      err.status = 409;
      err.code = 'RUBRIC_IN_USE_COPY_REQUIRED';
      err.associationCount = associationCount;
      throw err;
    }
  }

  if (patch.title != null) doc.title = String(patch.title).trim() || doc.title;
  if (patch.criteria != null) {
    const normalized = normalizeCriteria(patch.criteria);
    if (!normalized.length) {
      const err = new Error('Rubric needs at least one criterion');
      err.status = 400;
      throw err;
    }
    doc.criteria = normalized;
    doc.pointsPossible = computePointsPossible(normalized);
  }
  if (patch.freeFormCriterionComments != null) {
    doc.freeFormCriterionComments = Boolean(patch.freeFormCriterionComments);
  }
  if (patch.workflowState && ['active', 'archived', 'deleted'].includes(patch.workflowState)) {
    if (patch.workflowState === 'deleted') {
      const err = new Error('Use deleteRubric to remove a bank rubric');
      err.status = 400;
      throw err;
    }
    doc.workflowState = patch.workflowState;
  }
  await doc.save();

  // Canvas-like: when a single association exists, keep that assignment snapshot in sync.
  if (changingDefinition) {
    await syncAssignmentSnapshotsFromBank(doc, rootAccountId);
  }

  return doc;
}

async function getRubric(rubricId, { user, req }) {
  const rootAccountId = rootAccountIdFromRequest(req) || user?.rootAccountId;
  const doc = await Rubric.findOne(
    withTenantFilter({ _id: rubricId, workflowState: { $ne: 'deleted' } }, rootAccountId)
  );
  if (!doc) {
    const err = new Error('Rubric not found');
    err.status = 404;
    throw err;
  }
  return doc;
}

function rubricBankScope(doc) {
  return doc?.courseId ? 'course' : 'account';
}

function isInstitutionAdmin(user) {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'platform_admin';
}

async function countRubricAssociations(rubricId, rootAccountId) {
  if (!rubricId) return 0;
  return Assignment.countDocuments(
    withTenantFilter({ rubricId }, rootAccountId)
  );
}

async function listRubricAssociations(rubricId, { user, req, limit = 25 }) {
  const rootAccountId = rootAccountIdFromRequest(req) || user?.rootAccountId;
  const rows = await Assignment.find(withTenantFilter({ rubricId }, rootAccountId))
    .select('_id title')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  const associationCount = await countRubricAssociations(rubricId, rootAccountId);
  return {
    associationCount,
    assignments: rows.map((a) => ({ _id: a._id, title: a.title || 'Assignment' })),
  };
}

async function associationCountsByRubricIds(rubricIds, rootAccountId) {
  const ids = (rubricIds || []).filter(Boolean);
  if (!ids.length) return new Map();
  const rows = await Assignment.aggregate([
    { $match: withTenantFilter({ rubricId: { $in: ids } }, rootAccountId) },
    { $group: { _id: '$rubricId', count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), row.count);
  }
  return map;
}

async function syncAssignmentSnapshotsFromBank(rubricDoc, rootAccountId) {
  const snapshot = toSnapshot(rubricDoc);
  await Assignment.updateMany(
    withTenantFilter({ rubricId: rubricDoc._id }, rootAccountId),
    {
      $set: {
        rubric: snapshot,
        useRubricForGrading: true,
      },
    }
  );
}

/**
 * Canvas-style delete: remove bank rubric and detach from all associated assignments.
 * Criterion assessments are cleared; total points already in the gradebook are kept.
 * Institution (account) rubrics may only be deleted by admins.
 */
async function deleteRubric(rubricId, { user, req }) {
  const rootAccountId = rootAccountIdFromRequest(req) || user?.rootAccountId;
  const doc = await Rubric.findOne(
    withTenantFilter({ _id: rubricId, workflowState: { $ne: 'deleted' } }, rootAccountId)
  );
  if (!doc) {
    const err = new Error('Rubric not found');
    err.status = 404;
    throw err;
  }

  if (!doc.courseId && !isInstitutionAdmin(user)) {
    const err = new Error(
      'Institution rubrics can only be deleted by an administrator. You can copy it into this course or archive it instead.'
    );
    err.status = 403;
    err.code = 'RUBRIC_ACCOUNT_DELETE_FORBIDDEN';
    throw err;
  }

  const associations = await Assignment.find(withTenantFilter({ rubricId: doc._id }, rootAccountId))
    .select('_id')
    .lean();
  const assignmentIds = associations.map((a) => a._id);

  if (assignmentIds.length) {
    await Assignment.updateMany(
      { _id: { $in: assignmentIds } },
      {
        $set: {
          rubricId: null,
          useRubricForGrading: false,
        },
        $unset: { rubric: 1 },
      }
    );
    await Submission.updateMany(
      { assignment: { $in: assignmentIds } },
      { $unset: { rubricAssessment: 1 } }
    );
  }

  doc.workflowState = 'deleted';
  await doc.save();

  return {
    _id: doc._id,
    workflowState: doc.workflowState,
    detachedAssignmentCount: assignmentIds.length,
  };
}

/**
 * Course/account rubric bank listing (Phase 4).
 * - With courseId + scope=all (default): course rubrics + institution (courseId null)
 * - scope=course: only this course
 * - scope=account: only institution-shared
 * - q: case-insensitive title search
 */
async function listRubrics({ courseId, scope = 'all', q, includeArchived = false, user, req }) {
  const rootAccountId = rootAccountIdFromRequest(req) || user?.rootAccountId;
  const states = includeArchived ? ['active', 'archived'] : ['active'];
  const scopeKey = String(scope || 'all').toLowerCase();

  let courseClause = {};
  if (courseId) {
    if (scopeKey === 'course') {
      courseClause = { courseId };
    } else if (scopeKey === 'account') {
      courseClause = { courseId: null };
    } else {
      courseClause = { $or: [{ courseId }, { courseId: null }] };
    }
  } else if (scopeKey === 'course') {
    courseClause = { courseId: { $ne: null } };
  } else if (scopeKey === 'account') {
    courseClause = { courseId: null };
  }

  const filter = withTenantFilter(
    {
      workflowState: { $in: states },
      ...courseClause,
      ...(q && String(q).trim()
        ? { title: { $regex: String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        : {}),
    },
    rootAccountId
  );

  const rows = await Rubric.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
  const counts = await associationCountsByRubricIds(
    rows.map((r) => r._id),
    rootAccountId
  );
  return rows.map((row) => ({
    ...row,
    scope: rubricBankScope(row),
    associationCount: counts.get(String(row._id)) || 0,
  }));
}

/** Duplicate a bank rubric into a course (or account) bank. */
async function copyRubric(rubricId, { courseId, title, user, req }) {
  const source = await getRubric(rubricId, { user, req });
  return createRubric({
    title: String(title || `${source.title} (copy)`).trim() || 'Rubric copy',
    criteria: source.criteria,
    courseId: courseId === undefined ? source.courseId : courseId || null,
    freeFormCriterionComments: source.freeFormCriterionComments,
    user,
    req,
  });
}

/**
 * Resolve attach payload from assignment FormData / JSON body.
 * Returns { clear, rubricId, snapshot } or null if no rubric change requested.
 */
async function resolveAssignmentRubricFields(body, { user, req, courseId }) {
  if (body == null) return null;
  const clear =
    body.clearRubric === true ||
    body.clearRubric === 'true' ||
    body.rubricId === '' ||
    body.rubricId === 'null';

  if (clear) {
    return { clear: true, rubricId: null, snapshot: null, useRubricForGrading: false };
  }

  let inline = body.rubric;
  if (typeof inline === 'string' && inline.trim()) {
    try {
      inline = JSON.parse(inline);
    } catch {
      inline = null;
    }
  }

  if (inline && typeof inline === 'object' && Array.isArray(inline.criteria)) {
    let doc;
    if (body.rubricId) {
      try {
        doc = await updateRubric(
          body.rubricId,
          {
            title: inline.title,
            criteria: inline.criteria,
            freeFormCriterionComments: inline.freeFormCriterionComments,
          },
          { user, req }
        );
      } catch (err) {
        // Canvas: shared rubric edit creates a new course copy for this assignment.
        if (err.code === 'RUBRIC_IN_USE_COPY_REQUIRED' || err.status === 409) {
          doc = await createRubric({
            title: inline.title,
            criteria: inline.criteria,
            courseId: courseId || inline.courseId || null,
            freeFormCriterionComments: inline.freeFormCriterionComments,
            user,
            req,
          });
        } else if (err.status === 404) {
          doc = null;
        } else {
          throw err;
        }
      }
    }
    if (!doc) {
      doc = await createRubric({
        title: inline.title,
        criteria: inline.criteria,
        courseId: courseId || inline.courseId || null,
        freeFormCriterionComments: inline.freeFormCriterionComments,
        user,
        req,
      });
    }
    const snapshot = toSnapshot(doc);
    return {
      clear: false,
      rubricId: doc._id,
      snapshot,
      useRubricForGrading:
        body.useRubricForGrading === undefined
          ? true
          : body.useRubricForGrading === true || body.useRubricForGrading === 'true',
      syncTotalPoints: true,
    };
  }

  if (body.rubricId) {
    const doc = await getRubric(body.rubricId, { user, req });
    const snapshot = toSnapshot(doc);
    return {
      clear: false,
      rubricId: doc._id,
      snapshot,
      useRubricForGrading:
        body.useRubricForGrading === undefined
          ? true
          : body.useRubricForGrading === true || body.useRubricForGrading === 'true',
      syncTotalPoints: body.syncTotalPointsFromRubric === true || body.syncTotalPointsFromRubric === 'true',
    };
  }

  return null;
}

function applyRubricToAssignment(assignment, resolved) {
  if (!resolved) return;
  if (resolved.clear) {
    assignment.rubricId = null;
    assignment.rubric = undefined;
    assignment.useRubricForGrading = false;
    if (typeof assignment.markModified === 'function') assignment.markModified('rubric');
    return;
  }
  assignment.rubricId = resolved.rubricId;
  assignment.rubric = resolved.snapshot;
  assignment.useRubricForGrading = resolved.useRubricForGrading !== false;
  if (typeof assignment.markModified === 'function') assignment.markModified('rubric');
  if (resolved.syncTotalPoints && resolved.snapshot?.pointsPossible != null) {
    assignment.totalPoints = resolved.snapshot.pointsPossible;
  }
}

/**
 * Normalize teacher rubricAssessment against assignment.rubric snapshot.
 * Returns { assessment, score } or throws with .status
 */
function normalizeRubricAssessment(raw, rubricSnapshot) {
  const criteria = Array.isArray(rubricSnapshot?.criteria) ? rubricSnapshot.criteria : [];
  if (!criteria.length) {
    const err = new Error('Assignment has no rubric to assess');
    err.status = 400;
    throw err;
  }
  if (!raw || typeof raw !== 'object') {
    const err = new Error('rubricAssessment is required');
    err.status = 400;
    throw err;
  }

  const incoming =
    raw.criterionAssessments && typeof raw.criterionAssessments === 'object'
      ? raw.criterionAssessments
      : {};

  const criterionAssessments = {};
  let score = 0;

  for (const criterion of criteria) {
    const entry = incoming[criterion.id] || incoming[String(criterion.id)] || {};
    const ratings = Array.isArray(criterion.ratings) ? criterion.ratings : [];
    let points = entry.points != null ? Number(entry.points) : NaN;
    let ratingId = entry.ratingId != null ? String(entry.ratingId) : null;

    if (ratingId) {
      const rating = ratings.find((r) => String(r.id) === ratingId);
      if (!rating) {
        const err = new Error(`Invalid rating for criterion "${criterion.description}"`);
        err.status = 400;
        throw err;
      }
      points = Number(rating.points) || 0;
    }

    if (!Number.isFinite(points)) {
      const err = new Error(`Missing points for criterion "${criterion.description}"`);
      err.status = 400;
      throw err;
    }

    const maxPts = Number(criterion.points) || 0;
    if (points < 0 || points > maxPts + 0.0001) {
      const err = new Error(
        `Points for "${criterion.description}" must be between 0 and ${maxPts}`
      );
      err.status = 400;
      throw err;
    }

    criterionAssessments[criterion.id] = {
      points,
      ratingId: ratingId || null,
      comments: String(entry.comments || '').trim(),
    };
    score += points;
  }

  score = Math.round(score * 100) / 100;

  return {
    assessment: {
      score,
      pointsPossible: Number(rubricSnapshot.pointsPossible) || computePointsPossible(criteria),
      criterionAssessments,
      freeFormCriterionComments: rubricSnapshot.freeFormCriterionComments !== false,
    },
    score,
  };
}

/**
 * Apply assessment onto a submission document. Optionally sets grade/finalGrade.
 */
function applyRubricAssessmentToSubmission(submission, assignment, rawAssessment, { userId } = {}) {
  const snapshot = assignment?.rubric;
  const { assessment, score } = normalizeRubricAssessment(rawAssessment, snapshot);
  assessment.assessedAt = new Date().toISOString();
  if (userId) assessment.assessedBy = String(userId);

  submission.rubricAssessment = assessment;
  if (typeof submission.markModified === 'function') submission.markModified('rubricAssessment');

  const useForGrading = assignment.useRubricForGrading !== false;
  if (useForGrading) {
    submission.grade = score;
    submission.finalGrade = score;
    submission.teacherApproved = true;
    if (userId) submission.gradedBy = userId;
    submission.gradedAt = new Date();
  }

  return { assessment, score, useForGrading };
}

module.exports = {
  newId,
  normalizeCriteria,
  computePointsPossible,
  toSnapshot,
  emptyRubricDraft,
  createRubric,
  updateRubric,
  getRubric,
  listRubrics,
  copyRubric,
  deleteRubric,
  listRubricAssociations,
  countRubricAssociations,
  rubricBankScope,
  resolveAssignmentRubricFields,
  applyRubricToAssignment,
  normalizeRubricAssessment,
  applyRubricAssessmentToSubmission,
};
