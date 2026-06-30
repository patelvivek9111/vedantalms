const Announcement = require('../models/announcement.model');
const Course = require('../models/course.model');
const mongoose = require('mongoose');
const fileAssetService = require('../services/fileAsset.service');
const { assertCourseFilesMutable } = require('../services/fileLifecycle.service');

// Get all announcements for a course
exports.getAnnouncementsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    
    // Validate courseId - check for undefined, null, empty string, or "undefined" string
    if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '' || courseId === undefined) {
  
      return res.status(400).json({
        success: false,
        message: 'Course ID is required and must be valid'
      });
    }

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    let query = { course: courseId };
    const groupsetId = req.query.groupset;
    // Only filter for students
    if (req.user && req.user.role === 'student') {
      const now = new Date();
      if (groupsetId) {
        query = { ...query, postTo: 'groupset', groupset: groupsetId };
      } else {
        query = { ...query, postTo: 'all' };
      }
      query = {
        ...query,
        $or: [
          { 'options.delayPosting': { $ne: true } },
          { delayedUntil: { $exists: false } },
          { delayedUntil: { $lte: now } }
        ]
      };
      const announcements = await Announcement.find(query)
        .populate('author', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 });

      return res.json({ success: true, data: announcements });
    }
    // For teachers/admins, show all announcements for the course
    if (groupsetId) {
      query = { ...query, postTo: 'groupset', groupset: groupsetId };
    }
    const announcements = await Announcement.find(query)
      .populate('author', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Create a new announcement
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, body, postTo, options } = req.body;
    const courseId = req.params.courseId;
    
    // Validate courseId - check for undefined, null, empty string, or "undefined" string
    if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '' || courseId === undefined) {
  
      return res.status(400).json({
        success: false,
        message: 'Course ID is required and must be valid'
      });
    }

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    await assertCourseFilesMutable(course, req.user, { action: 'announcement_attachment_upload' });
    const { fileAssetIds, attachments } = await fileAssetService.resolveAttachmentsFromRequest(req, {
      user: req.user,
      courseId: course._id,
      category: 'announcement',
    });
    let groupsetId = undefined;
    let postToValue = 'all';
    if (postTo && postTo !== 'all') {
      groupsetId = postTo;
      postToValue = 'groupset';
    }
    const announcement = await Announcement.create({
      title,
      body,
      course: courseId,
      author: req.user._id,
      attachments,
      fileAssets: fileAssetIds,
      postTo: postToValue,
      groupset: groupsetId,
      options: options ? JSON.parse(options) : {},
      delayedUntil: req.body.delayedUntil || undefined,
    });

    // Notify all enrolled students about new announcement
    try {
      const { notifyAnnouncementCreated } = require('../services/notification/academicNotificationProducers.service');
      void notifyAnnouncementCreated({
        course: courseId,
        announcement,
        actor: req.user,
        requestId: req.requestId || null,
      }).catch((notifError) => {
        console.error('Error creating announcement notifications:', notifError);
      });
    } catch (notifError) {
      console.error('Error creating announcement notifications:', notifError);
    }

    try {
      const {
        recordDomainEvent,
        DOMAIN_EVENT_TYPES,
        AGGREGATE_TYPES,
        AUDIENCE_SCOPES,
      } = require('../services/domainEvents');
      void recordDomainEvent({
        eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED,
        aggregateType: AGGREGATE_TYPES.ANNOUNCEMENT,
        aggregateId: announcement._id,
        actorId: req.user._id,
        audienceScope: AUDIENCE_SCOPES.COURSE,
        correlationId: req.requestId,
        payload: {
          courseId: String(courseId),
          title,
          postTo: postToValue,
        },
        metadata: { source: 'announcement.controller.createAnnouncement' },
      });
    } catch (domainEventError) {
      console.error('announcement_domain_event_failed', domainEventError);
    }

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Get all comments for an announcement (threaded)
exports.getAnnouncementComments = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate({
        path: 'comments.author',
        select: 'firstName lastName profilePicture',
      })
      .lean();
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    // Recursively populate authors in nested replies
    function populateReplies(comments) {
      return comments.map(comment => ({
        ...comment,
        author: comment.author,
        replies: comment.replies ? populateReplies(comment.replies) : []
      }));
    }
    const comments = announcement.comments ? populateReplies(announcement.comments) : [];
    res.json({ success: true, data: comments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Add a top-level comment to an announcement
exports.addAnnouncementComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const comment = {
      author: req.user._id,
      text,
      createdAt: new Date(),
      replies: []
    };
    announcement.comments.push(comment);
    await announcement.save();
    res.status(201).json({ success: true, message: 'Comment added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Add a reply to a comment (threaded)
exports.replyToAnnouncementComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    // Recursive function to find and add reply as a Mongoose subdocument
    function addReply(comments, commentId, replyData) {
      for (let comment of comments) {
        if (comment._id.toString() === commentId) {
          // Use Mongoose subdocument constructor for nested replies
          comment.replies.push(comment.replies.create(replyData));
          return true;
        }
        if (comment.replies && addReply(comment.replies, commentId, replyData)) {
          return true;
        }
      }
      return false;
    }
    const replyData = {
      author: req.user._id,
      text,
      createdAt: new Date(),
      replies: []
    };
    const added = addReply(announcement.comments, req.params.commentId, replyData);
    if (!added) return res.status(404).json({ success: false, message: 'Comment not found' });
    announcement.markModified('comments');
    await announcement.save();
    res.status(201).json({ success: true, message: 'Reply added' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Like a comment or reply (threaded)
exports.likeAnnouncementComment = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const userId = req.user._id.toString();
    // Recursive function to find and like comment
    function likeComment(comments, commentId) {
      for (let comment of comments) {
        if (comment._id.toString() === commentId) {
          if (!comment.likes.map(id => id.toString()).includes(userId)) {
            comment.likes.push(userId);
          }
          return true;
        }
        if (comment.replies && likeComment(comment.replies, commentId)) {
          return true;
        }
      }
      return false;
    }
    const liked = likeComment(announcement.comments, req.params.commentId);
    if (!liked) return res.status(404).json({ success: false, message: 'Comment not found' });
    announcement.markModified('comments');
    await announcement.save();
    res.status(200).json({ success: true, message: 'Comment liked' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Unlike a comment or reply (threaded)
exports.unlikeAnnouncementComment = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const userId = req.user._id.toString();
    // Recursive function to find and unlike comment
    function unlikeComment(comments, commentId) {
      for (let comment of comments) {
        if (comment._id.toString() === commentId) {
          comment.likes = comment.likes.filter(id => id.toString() !== userId);
          return true;
        }
        if (comment.replies && unlikeComment(comment.replies, commentId)) {
          return true;
        }
      }
      return false;
    }
    const unliked = unlikeComment(announcement.comments, req.params.commentId);
    if (!unliked) return res.status(404).json({ success: false, message: 'Comment not found' });
    announcement.markModified('comments');
    await announcement.save();
    res.status(200).json({ success: true, message: 'Comment unliked' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Update an announcement
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    // Only allow author, teacher, or admin
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'teacher' &&
      announcement.author.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { title, body, options, delayedUntil } = req.body;
    if (title) announcement.title = title;
    if (body) announcement.body = body;
    if (options) announcement.options = JSON.parse(options);
    if (delayedUntil) announcement.delayedUntil = delayedUntil;
    if (req.files?.length) {
      const course = await Course.findById(announcement.course);
      if (course) await assertCourseFilesMutable(course, req.user, { action: 'announcement_attachment_update' });
      if (announcement.fileAssets?.length) {
        for (const id of announcement.fileAssets) {
          await fileAssetService.deleteFileAsset(id, req.user, { ip: req.ip }).catch(() => {});
        }
      }
      const assets = await fileAssetService.createFileAssetsFromMulter(req.files, {
        uploadedBy: req.user,
        category: 'announcement',
        courseId: announcement.course,
        announcementId: announcement._id,
        visibility: 'course',
        accessScope: { enrolledOnly: true },
        metadata: { ip: req.ip, requestId: req.requestId },
      });
      announcement.fileAssets = assets.map((a) => a._id);
      announcement.attachments = assets.map((a) => fileAssetService.buildDownloadPath(a._id));
    }
    await announcement.save();
    res.json({ success: true, data: announcement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Delete an announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    // Only allow author, teacher, or admin
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'teacher' &&
      announcement.author.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await announcement.deleteOne();
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}; 