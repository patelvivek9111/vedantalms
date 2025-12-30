const Announcement = require('../models/announcement.model');
const Course = require('../models/course.model');
const mongoose = require('mongoose');
const { asyncHandler } = require('../utils/errorHandler');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errorHandler');

// Get all announcements for a course
exports.getAnnouncementsByCourse = asyncHandler(async (req, res) => {
  const courseId = req.params.courseId;
  
  // Validate courseId - check for undefined, null, empty string, or "undefined" string
  if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '' || courseId === undefined) {
    throw new ValidationError('Course ID is required and must be valid');
  }

  // Validate if the ID is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ValidationError('Invalid course ID format');
  }

    let query = { course: courseId };
    const groupsetId = req.query.groupset;
    
    // Validate groupsetId if provided
    if (groupsetId && !mongoose.Types.ObjectId.isValid(groupsetId)) {
      throw new ValidationError('Invalid groupset ID format');
    }
    
    // Only filter for students
    if (req.user && req.user.role === 'student') {
      // Check if course is published
      const course = await Course.findById(courseId);
      if (!course || !course.published) {
        return res.json({ success: true, data: [] });
      }
      
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
        .populate('author', 'firstName lastName')
        .sort({ createdAt: -1 });

      return res.json({ success: true, data: announcements });
    }
    // For teachers/admins, show all announcements for the course
    if (groupsetId) {
      query = { ...query, postTo: 'groupset', groupset: groupsetId };
    }
    const announcements = await Announcement.find(query)
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: announcements });
});

// Create a new announcement
exports.createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, postTo, options } = req.body;
  const courseId = req.params.courseId;
  
  // Validate courseId - check for undefined, null, empty string, or "undefined" string
  if (!courseId || courseId === 'undefined' || courseId === 'null' || courseId === '' || courseId === undefined) {
    throw new ValidationError('Course ID is required and must be valid');
  }

  // Validate if the ID is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ValidationError('Invalid course ID format');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new NotFoundError('Course');
  }
  
  // Validate user is instructor or admin
  const userId = req.user._id || req.user.id;
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const isInstructor = course.instructor.toString() === userId.toString();
  const isAdmin = req.user.role === 'admin';
  
  if (!isInstructor && !isAdmin) {
    throw new ForbiddenError('Only course instructors can create announcements');
  }
  
  // Validate required fields
  if (!title || !title.trim()) {
    throw new ValidationError('Title is required');
  }
  
  if (!body || !body.trim()) {
    throw new ValidationError('Body is required');
  }
  
  const attachments = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
  let groupsetId = undefined;
  let postToValue = 'all';
  
  if (postTo && postTo !== 'all') {
    // Validate groupsetId if provided
    if (!mongoose.Types.ObjectId.isValid(postTo)) {
      throw new ValidationError('Invalid groupset ID format');
    }
    groupsetId = postTo;
    postToValue = 'groupset';
  }
  
  // Parse options safely
  let parsedOptions = {};
  if (options) {
    try {
      parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
    } catch (parseError) {
      throw new ValidationError('Invalid options JSON format');
    }
  }
  
  // Validate delayedUntil if provided
  let delayedUntilDate = undefined;
  if (req.body.delayedUntil) {
    delayedUntilDate = new Date(req.body.delayedUntil);
    if (isNaN(delayedUntilDate.getTime())) {
      throw new ValidationError('Invalid delayedUntil date format');
    }
  }
  
  const announcement = await Announcement.create({
    title: title.trim(),
    body: body.trim(),
    course: courseId,
    author: userId,
    attachments,
    postTo: postToValue,
    groupset: groupsetId,
    options: parsedOptions,
    delayedUntil: delayedUntilDate,
  });
  res.status(201).json({ success: true, data: announcement });
});

// Get all comments for an announcement (threaded)
exports.getAnnouncementComments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validate announcement ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  const announcement = await Announcement.findById(id)
    .populate({
      path: 'comments.author',
      select: 'firstName lastName',
    })
    .lean();
  if (!announcement) throw new NotFoundError('Announcement');
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
});

// Add a top-level comment to an announcement
exports.addAnnouncementComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.user._id || req.user.id;
  
  // Validate announcement ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  if (!text || !text.trim()) {
    throw new ValidationError('Text is required and cannot be empty');
  }
  
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  const comment = {
    author: userId,
    text: text.trim(),
    createdAt: new Date(),
    replies: []
  };
  announcement.comments.push(comment);
  await announcement.save();
  res.status(201).json({ success: true, message: 'Comment added' });
});

// Add a reply to a comment (threaded)
exports.replyToAnnouncementComment = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;
  const { text } = req.body;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ValidationError('Invalid comment ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  if (!text || !text.trim()) {
    throw new ValidationError('Text is required and cannot be empty');
  }
  
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
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
    author: userId,
    text: text.trim(),
    createdAt: new Date(),
    replies: []
  };
  const added = addReply(announcement.comments, commentId, replyData);
  if (!added) throw new NotFoundError('Comment');
  announcement.markModified('comments');
  await announcement.save();
  res.status(201).json({ success: true, message: 'Reply added' });
});

// Like a comment or reply (threaded)
exports.likeAnnouncementComment = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ValidationError('Invalid comment ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  const userIdStr = userId.toString();
  // Recursive function to find and like comment
  function likeComment(comments, commentId) {
    for (let comment of comments) {
      if (comment._id.toString() === commentId) {
        if (!comment.likes) {
          comment.likes = [];
        }
        if (!comment.likes.map(id => id.toString()).includes(userIdStr)) {
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
  const liked = likeComment(announcement.comments, commentId);
  if (!liked) throw new NotFoundError('Comment');
  announcement.markModified('comments');
  await announcement.save();
  res.status(200).json({ success: true, message: 'Comment liked' });
});

// Unlike a comment or reply (threaded)
exports.unlikeAnnouncementComment = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ValidationError('Invalid comment ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  const userIdStr = userId.toString();
  // Recursive function to find and unlike comment
  function unlikeComment(comments, commentId) {
    for (let comment of comments) {
      if (comment._id.toString() === commentId) {
        if (comment.likes && Array.isArray(comment.likes)) {
          comment.likes = comment.likes.filter(id => id.toString() !== userIdStr);
        }
        return true;
      }
      if (comment.replies && unlikeComment(comment.replies, commentId)) {
        return true;
      }
    }
    return false;
  }
  const unliked = unlikeComment(announcement.comments, commentId);
  if (!unliked) throw new NotFoundError('Comment');
  announcement.markModified('comments');
  await announcement.save();
  res.status(200).json({ success: true, message: 'Comment unliked' });
});

// Update an announcement
exports.updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate announcement ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  // Only allow author, teacher, or admin
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'teacher' &&
    announcement.author.toString() !== userId.toString()
  ) {
    throw new ForbiddenError('Not authorized');
  }
  
  const { title, body, options, delayedUntil } = req.body;
  if (title !== undefined) {
    if (!title || !title.trim()) {
      throw new ValidationError('Title cannot be empty');
    }
    announcement.title = title.trim();
  }
  if (body !== undefined) announcement.body = body;
  if (options) {
    try {
      announcement.options = typeof options === 'string' ? JSON.parse(options) : options;
    } catch (parseError) {
      throw new ValidationError('Invalid options JSON format');
    }
  }
  if (delayedUntil) {
    const delayedDate = new Date(delayedUntil);
    if (isNaN(delayedDate.getTime())) {
      throw new ValidationError('Invalid delayedUntil date format');
    }
    announcement.delayedUntil = delayedDate;
  }
  if (req.files && req.files.length > 0) {
    announcement.attachments = req.files.map(file => `/uploads/${file.filename}`);
  }
  await announcement.save();
  res.json({ success: true, data: announcement });
});

// Delete an announcement
exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate announcement ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid announcement ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new NotFoundError('Announcement');
  }
  
  // Only allow author, teacher, or admin
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'teacher' &&
    announcement.author.toString() !== userId.toString()
  ) {
    throw new ForbiddenError('Not authorized');
  }
  await announcement.deleteOne();
  res.json({ success: true, message: 'Announcement deleted' });
}); 