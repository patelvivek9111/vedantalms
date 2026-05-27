#!/usr/bin/env node
/**
 * Remove duplicate DiscussionParticipation rows (same threadId + userId).
 * Keeps the document with the greatest updatedAt (fallback _id).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');
const DiscussionParticipation = require('../../models/discussionParticipation.model');

const { apply, strict } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const dupGroups = await DiscussionParticipation.aggregate([
    {
      $group: {
        _id: { threadId: '$threadId', userId: '$userId' },
        ids: { $push: { id: '$_id', updatedAt: '$updatedAt' } },
        n: { $sum: 1 },
      },
    },
    { $match: { n: { $gt: 1 } } },
  ]);

  const toDelete = [];
  for (const g of dupGroups) {
    const sorted = [...g.ids].sort((a, b) => {
      const ta = new Date(a.updatedAt || 0).getTime();
      const tb = new Date(b.updatedAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    });
    const keep = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      toDelete.push(sorted[i].id);
    }
  }

  if (apply && toDelete.length) {
    await DiscussionParticipation.deleteMany({ _id: { $in: toDelete } });
  }

  const report = finishReport(
    {
      script: 'repair-duplicate-discussion-participation',
      apply,
      duplicateGroups: dupGroups.length,
      documentsToDelete: toDelete.length,
      samples: toDelete.slice(0, 25).map((id) => String(id)),
    },
    ['duplicateParticipation', 'participation']
  );

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && toDelete.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
