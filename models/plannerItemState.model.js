const mongoose = require('mongoose');

const plannerItemStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemKey: {
      type: String,
      required: true,
      trim: true,
    },
    surface: {
      type: String,
      enum: ['derived', 'todo', 'notification_derived'],
      default: 'derived',
    },
    status: {
      type: String,
      enum: ['dismissed', 'snoozed'],
      required: true,
    },
    snoozeUntil: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

plannerItemStateSchema.set('toObject', { flattenMaps: true });
plannerItemStateSchema.set('toJSON', { flattenMaps: true });

plannerItemStateSchema.index({ user: 1, itemKey: 1 }, { unique: true });
plannerItemStateSchema.index({ user: 1, status: 1, snoozeUntil: 1 });

module.exports = mongoose.model('PlannerItemState', plannerItemStateSchema);
