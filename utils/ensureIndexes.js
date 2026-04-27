const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Thread = require('../models/thread.model');
const Course = require('../models/course.model');

const criticalModels = [
  Message,
  ConversationParticipant,
  Submission,
  Assignment,
  Thread,
  Course
];

const ensureCriticalIndexes = async (logger = console) => {
  const shouldSync = process.env.SYNC_INDEXES_ON_BOOT === 'true' || process.env.NODE_ENV !== 'production';
  if (!shouldSync) {
    logger.info?.('Skipping index sync on boot');
    return;
  }

  for (const model of criticalModels) {
    await model.syncIndexes();
    logger.info?.({ model: model.modelName }, 'indexes.synced');
  }
};

module.exports = { ensureCriticalIndexes };
