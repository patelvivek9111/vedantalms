const mongoose = require('mongoose');
const crypto = require('crypto');

const domainEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    aggregateType: {
      type: String,
      required: true,
      index: true,
    },
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    institutionId: {
      type: String,
      default: null,
    },
    audienceScope: {
      type: String,
      enum: ['course', 'user', 'group', 'system'],
      default: 'system',
    },
    correlationId: {
      type: String,
      required: true,
      index: true,
    },
    payloadVersion: {
      type: Number,
      default: 1,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

domainEventSchema.index({ aggregateType: 1, aggregateId: 1, occurredAt: -1 });
domainEventSchema.index({ eventType: 1, occurredAt: -1 });

domainEventSchema.pre('save', function forbidMutationOnExisting(next) {
  if (!this.isNew) {
    return next(new Error('DomainEvent documents are immutable'));
  }
  return next();
});

['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach(
  (hook) => {
    domainEventSchema.pre(hook, function blockMutations() {
      throw new Error('DomainEvent documents are immutable');
    });
  }
);

module.exports = mongoose.model('DomainEvent', domainEventSchema);
