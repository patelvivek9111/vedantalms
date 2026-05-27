const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const Assignment = require('../models/Assignment');
const Thread = require('../models/thread.model');
const Announcement = require('../models/announcement.model');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const fileAssetService = require('./fileAsset.service');
const { assertCourseOperational } = require('./fileLifecycle.service');
const academicAuditService = require('./academicAudit.service');
const assignmentGroupService = require('./assignmentGroup.service');

/**
 * Copy course instructional content without grades, transcripts, or lifecycle snapshots.
 */
async function copyCourseContent(sourceCourseId, {
  targetTitle,
  requestedBy,
  includeAnnouncements = true,
  includeDiscussions = true,
}) {
  const source = await Course.findById(sourceCourseId).lean();
  if (!source) {
    const err = new Error('Source course not found');
    err.statusCode = 404;
    throw err;
  }

  const sourceGroups = assignmentGroupService.normalizeGroups(source.groups || []);
  const groupIdMap = new Map();
  const copiedGroups = sourceGroups.map((group) => {
    const newId = new mongoose.Types.ObjectId().toString();
    groupIdMap.set(String(group.id || group._id), newId);
    return { ...group, id: newId };
  });

  const newCourse = await Course.create({
    title: targetTitle || `${source.title} (Copy)`,
    description: source.description,
    instructor: requestedBy._id || requestedBy,
    published: false,
    operationalStatus: 'draft',
    groups: copiedGroups,
    gradeScale: source.gradeScale,
    catalog: {
      ...source.catalog,
      syllabusFiles: [],
    },
    semester: source.semester,
    overviewConfig: source.overviewConfig,
    sidebarConfig: source.sidebarConfig,
    defaultColor: source.defaultColor,
    copyOfCourseId: source._id,
  });

  const fileCloneOpts = {
    uploadedBy: requestedBy,
    courseId: newCourse._id,
  };

  if (source.catalog?.syllabusFiles?.length) {
    const urls = source.catalog.syllabusFiles;
    const ids = urls
      .map((f) => {
        const url = typeof f === 'string' ? f : f.url;
        const m = String(url || '').match(/\/api\/files\/([a-f0-9]{24})/i);
        return m ? m[1] : null;
      })
      .filter(Boolean);
    const cloned = await fileAssetService.cloneFileAssetIdsForCourseCopy(ids, {
      ...fileCloneOpts,
      category: 'syllabus',
    });
    newCourse.catalog = newCourse.catalog || {};
    newCourse.catalog.syllabusFiles = cloned.map((id) => ({
      name: 'syllabus-file',
      url: fileAssetService.buildDownloadPath(id),
    }));
    await newCourse.save();
  }

  const modules = await Module.find({ course: sourceCourseId }).sort({ order: 1 }).lean();
  const moduleIdMap = new Map();
  const groupSetIdMap = new Map();
  const discussionGroupIdMap = new Map();

  for (const mod of modules) {
    const newMod = await Module.create({
      title: mod.title,
      description: mod.description,
      course: newCourse._id,
      order: mod.order,
      published: false,
    });
    moduleIdMap.set(String(mod._id), newMod._id);

    const pages = await Page.find({ module: mod._id }).lean();
    for (const page of pages) {
      const clonedFiles = await fileAssetService.cloneFileAssetIdsForCourseCopy(page.fileAssets || [], {
        ...fileCloneOpts,
        category: 'page',
      });
      const newPage = await Page.create({
        title: page.title,
        content: page.content,
        module: newMod._id,
        attachments: clonedFiles.map((id) => fileAssetService.buildDownloadPath(id)),
        fileAssets: clonedFiles,
        published: false,
      });
      newMod.pages = newMod.pages || [];
      newMod.pages.push(newPage._id);
    }

    const assignments = await Assignment.find({ module: mod._id }).lean();
    for (const a of assignments) {
      const clonedFiles = await fileAssetService.cloneFileAssetIdsForCourseCopy(a.fileAssets || [], {
        ...fileCloneOpts,
        category: 'assignment',
      });
      await Assignment.create({
        title: a.title,
        description: a.description,
        module: newMod._id,
        availableFrom: a.availableFrom,
        dueDate: a.dueDate,
        attachments: clonedFiles.map((id) => fileAssetService.buildDownloadPath(id)),
        fileAssets: clonedFiles,
        questions: a.questions,
        isGroupAssignment: a.isGroupAssignment,
        allowStudentUploads: a.allowStudentUploads,
        displayMode: a.displayMode,
        isGradedQuiz: a.isGradedQuiz,
        quizSubmissionMode: a.quizSubmissionMode || 'online',
        isTimedQuiz: a.isTimedQuiz,
        quizTimeLimit: a.quizTimeLimit,
        showCorrectAnswers: a.showCorrectAnswers,
        showStudentAnswers: a.showStudentAnswers,
        isOfflineAssignment: a.isOfflineAssignment,
        totalPoints: a.totalPoints,
        group: a.group,
        groupId: a.groupId ? groupIdMap.get(String(a.groupId)) : undefined,
        gradeReleaseMode: a.gradeReleaseMode,
        defaultGradeHidden: a.defaultGradeHidden,
        lockAfterDue: a.lockAfterDue,
        published: false,
        createdBy: requestedBy._id || requestedBy,
      });
    }
    await newMod.save();
  }

  const groupSets = await GroupSet.find({ course: sourceCourseId }).lean();
  for (const groupSet of groupSets) {
    const newGroupSet = await GroupSet.create({
      name: groupSet.name,
      course: newCourse._id,
      allowSelfSignup: groupSet.allowSelfSignup,
      groupStructure: groupSet.groupStructure,
    });
    groupSetIdMap.set(String(groupSet._id), newGroupSet._id);

    const groups = await Group.find({ groupSet: groupSet._id }).lean();
    for (const group of groups) {
      const newGroup = await Group.create({
        name: group.name,
        groupSet: newGroupSet._id,
        members: [],
        leader: undefined,
        groupId: new mongoose.Types.ObjectId().toString(),
        course: newCourse._id,
      });
      discussionGroupIdMap.set(String(group._id), newGroup._id);
    }
  }

  if (includeDiscussions) {
    const threads = await Thread.find({ course: sourceCourseId }).lean();
    for (const t of threads) {
      const clonedFiles = await fileAssetService.cloneFileAssetIdsForCourseCopy(t.fileAssets || [], {
        ...fileCloneOpts,
        category: 'discussion',
      });
      await Thread.create({
        title: t.title,
        content: t.content,
        course: newCourse._id,
        module: t.module ? moduleIdMap.get(String(t.module)) : undefined,
        author: requestedBy._id || requestedBy,
        isGraded: t.isGraded,
        totalPoints: t.totalPoints,
        group: t.group,
        groupSet: t.groupSet ? groupSetIdMap.get(String(t.groupSet)) : undefined,
        groupId: t.groupId ? discussionGroupIdMap.get(String(t.groupId)) : undefined,
        dueDate: t.dueDate,
        availableFrom: t.availableFrom,
        locked: false,
        lockAfterDue: t.lockAfterDue,
        discussionReleaseMode: t.discussionReleaseMode,
        gradeHidden: t.gradeHidden,
        settings: t.settings,
        fileAssets: clonedFiles,
        published: false,
      });
    }
  }

  if (includeAnnouncements) {
    const announcements = await Announcement.find({ course: sourceCourseId }).lean();
    for (const ann of announcements) {
      const clonedFiles = await fileAssetService.cloneFileAssetIdsForCourseCopy(ann.fileAssets || [], {
        ...fileCloneOpts,
        category: 'announcement',
      });
      await Announcement.create({
        title: ann.title,
        body: ann.body,
        course: newCourse._id,
        author: requestedBy._id || requestedBy,
        attachments: clonedFiles.map((id) => fileAssetService.buildDownloadPath(id)),
        fileAssets: clonedFiles,
        postTo: ann.postTo,
        groupset: ann.groupset,
        options: ann.options,
      });
    }
  }

  await academicAuditService.recordAuditEvent({
    actorId: requestedBy._id || requestedBy,
    entityType: 'course',
    entityId: newCourse._id,
    action: 'course_content_copied',
    metadata: { sourceCourseId: String(sourceCourseId) },
  }).catch(() => {});

  return { course: newCourse, moduleIdMap: Object.fromEntries(moduleIdMap) };
}

async function archiveCourse(courseId, user) {
  const course = await Course.findById(courseId);
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }
  course.operationalStatus = 'archived';
  course.archivedAt = new Date();
  course.archivedBy = user._id;
  course.published = false;
  await course.save();
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'course',
    entityId: course._id,
    action: 'course_archived',
  }).catch(() => {});
  return course;
}

async function restoreCourse(courseId, user) {
  const course = await Course.findById(courseId);
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }
  course.operationalStatus = 'active';
  course.restoredAt = new Date();
  course.archivedAt = null;
  await course.save();
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'course',
    entityId: course._id,
    action: 'course_restored',
  }).catch(() => {});
  return course;
}

module.exports = {
  copyCourseContent,
  archiveCourse,
  restoreCourse,
};
