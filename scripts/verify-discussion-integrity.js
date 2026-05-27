#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Group = require('../models/Group');
const DiscussionReply = require('../models/discussionReply.model');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);

  const issues = [];
  const threads = await Thread.find({ deletedAt: null }).select(
    '_id course module groupSet groupId published replies counters studentGrades'
  ).lean();

  for (const thread of threads) {
    const course = await Course.findById(thread.course).select('_id').lean();
    if (!course) issues.push({ thread: String(thread._id), issue: 'missing_course' });

    if (thread.module) {
      const module = await Module.findById(thread.module).select('_id course').lean();
      if (!module) issues.push({ thread: String(thread._id), issue: 'missing_module' });
      if (module && String(module.course) !== String(thread.course)) {
        issues.push({ thread: String(thread._id), issue: 'module_course_mismatch' });
      }
    }

    if (thread.groupId) {
      const group = await Group.findById(thread.groupId).select('_id groupSet course').lean();
      if (!group) issues.push({ thread: String(thread._id), issue: 'missing_group' });
      if (group && thread.groupSet && String(group.groupSet) !== String(thread.groupSet)) {
        issues.push({ thread: String(thread._id), issue: 'group_set_mismatch' });
      }
    }

    const replyCount = Array.isArray(thread.replies) ? thread.replies.length : 0;
    if (replyCount > 1000) {
      issues.push({ thread: String(thread._id), issue: 'large_embedded_reply_array', replyCount });
    }
    const collectionReplyCount = await DiscussionReply.countDocuments({
      threadId: thread._id,
      deletedAt: null,
    });
    const counterReplyCount = thread.counters?.replyCount || 0;
    if (collectionReplyCount > 0 && counterReplyCount !== collectionReplyCount) {
      issues.push({
        thread: String(thread._id),
        issue: 'reply_counter_mismatch',
        counterReplyCount,
        collectionReplyCount,
      });
    }
    const orphanedChildren = await DiscussionReply.countDocuments({
      threadId: thread._id,
      parentReplyId: { $ne: null },
      deletedAt: null,
      $expr: { $eq: ['$parentReplyId', '$_id'] },
    });
    if (orphanedChildren > 0) {
      issues.push({ thread: String(thread._id), issue: 'self_parented_replies', count: orphanedChildren });
    }
  }

  console.log(JSON.stringify({ checked: threads.length, issues }, null, 2));
  await mongoose.disconnect();
  process.exit(issues.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
