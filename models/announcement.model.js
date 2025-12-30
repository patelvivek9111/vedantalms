const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // for like/thumbs
  // replies will be added recursively below
}, { _id: true });

commentSchema.add({ replies: [commentSchema] }); // recursive reference for nested replies

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attachments: [{ type: String }],
  postTo: { type: String, enum: ['all', 'groupset'], default: 'all' },
  groupset: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupSet' },
  options: {
    delayPosting: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: false },
    requirePostBeforeSeeingReplies: { type: Boolean, default: false },
    enablePodcastFeed: { type: Boolean, default: false },
    allowLiking: { type: Boolean, default: false }
  },
  delayedUntil: { type: Date },
  comments: [commentSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', announcementSchema); 