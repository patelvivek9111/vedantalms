const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const { protect, authorize } = require('../middleware/auth');

// Helper function to check if user is authorized to modify content
const isAuthorized = (user, contentAuthor, isTeacher) => {
  if (!user || !user._id || !contentAuthor) {
    return false;
  }
  return user._id.toString() === contentAuthor.toString() || isTeacher;
};

// Get all threads for a course
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }
    
    const threads = await Thread.find({ course: req.params.courseId })
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: '_id firstName lastName role profilePicture'
        }
      })
      .sort({ lastActivity: -1 });

    res.json({
      success: true,
      data: threads
    });
  } catch (error) {
    console.error('Error fetching course threads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching discussion threads'
    });
  }
});

// Get threads for a specific groupset
router.get('/groupset/:groupSetId', protect, async (req, res) => {
  try {
    // Validate groupSetId
    if (!mongoose.Types.ObjectId.isValid(req.params.groupSetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group set ID format'
      });
    }
    
    const threads = await Thread.find({ groupSet: req.params.groupSetId })
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: '_id firstName lastName role profilePicture'
        }
      })
      .sort({ lastActivity: -1 });

    res.json({
      success: true,
      data: threads
    });
  } catch (error) {
    console.error('Error fetching groupset threads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching group discussion threads'
    });
  }
});

// Create a new thread
router.post('/', protect, authorize(['teacher', 'admin']), async (req, res) => {
  try {
    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const { 
      title, 
      content, 
      courseId, 
      module, 
      isGraded, 
      totalPoints, 
      group, 
      dueDate, 
      groupSet,
      settings 
    } = req.body;
    
    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thread title is required'
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thread content is required'
      });
    }

    // Validate courseId
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid course ID is required'
      });
    }

    // Validate totalPoints if isGraded
    if (isGraded) {
      if (totalPoints === undefined || totalPoints === null) {
        return res.status(400).json({
          success: false,
          message: 'Total points is required for graded discussions'
        });
      }
      const points = parseFloat(totalPoints);
      if (isNaN(points) || points <= 0 || points > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Total points must be a number between 1 and 1000'
        });
      }
    }

    // Validate module if provided
    if (module !== undefined && module !== null && !mongoose.Types.ObjectId.isValid(module)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid module ID format'
      });
    }

    // Validate groupSet if provided
    if (groupSet !== undefined && groupSet !== null && !mongoose.Types.ObjectId.isValid(groupSet)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group set ID format'
      });
    }
    
    const thread = new Thread({
      title: title.trim(),
      content: content.trim(),
      course: courseId,
      author: userId,
      module: module || undefined,
      groupSet: groupSet || undefined,
      isGraded: isGraded || false,
      totalPoints: isGraded ? parseFloat(totalPoints) : null,
      group: group || 'Discussions',
      dueDate: dueDate || null,
      settings: {
        requirePostBeforeSee: settings?.requirePostBeforeSee || false,
        allowLikes: settings?.allowLikes !== undefined ? settings.allowLikes : true,
        allowComments: settings?.allowComments !== undefined ? settings.allowComments : true
      }
    });

    await thread.save();
    
    const populatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name');

    res.status(201).json({
      success: true,
      data: populatedThread
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating discussion thread'
    });
  }
});

// Get a single thread with replies
router.get('/:threadId', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }
    
    const thread = await Thread.findById(req.params.threadId)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    res.json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching thread'
    });
  }
});

// Add a reply to a thread or to another reply
router.post('/:threadId/replies', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const { content, parentReply } = req.body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required'
      });
    }

    // Validate parentReply if provided
    if (parentReply !== undefined && parentReply !== null && !mongoose.Types.ObjectId.isValid(parentReply)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent reply ID format'
      });
    }

    const thread = await Thread.findById(req.params.threadId);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // If replying to another reply, verify it exists
    if (parentReply) {
      const parentReplyExists = thread.replies.some(reply => reply._id.toString() === parentReply);
      if (!parentReplyExists) {
        return res.status(404).json({
          success: false,
          message: 'Parent reply not found'
        });
      }
    }

    // Add the reply
    thread.replies.push({
      content: content.trim(),
      author: userId,
      parentReply: parentReply || null
    });

    // If this is a graded discussion and the user is a student
    if (thread.isGraded && req.user.role === 'student') {
      // Check if student already has a grade entry
      const existingGradeIndex = thread.studentGrades.findIndex(
        g => g.student.toString() === req.user._id.toString()
      );

      if (existingGradeIndex === -1) {
        // Create a new grade entry with null grade (indicating submission without grade)
        thread.studentGrades.push({
          student: req.user._id,
          grade: null,
          feedback: null,
          gradedAt: null,
          gradedBy: null
        });
      }
    }

    await thread.save();

    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    res.json({
      success: true,
      data: updatedThread
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding reply'
    });
  }
});

// Update a thread
router.put('/:threadId', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if user is authorized to edit
    if (!thread.author || !isAuthorized(req.user, thread.author, req.user.role === 'teacher')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this thread'
      });
    }

    const { title, content, isGraded, totalPoints, group, dueDate, module, groupSet, settings } = req.body;
    
    // Validate title if provided
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty'
        });
      }
      thread.title = title.trim();
    }
    
    // Validate content if provided
    if (content !== undefined) {
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Content cannot be empty'
        });
      }
      thread.content = content.trim();
    }
    
    thread.isGraded = isGraded !== undefined ? isGraded : thread.isGraded;
    
    // Validate totalPoints if isGraded
    if (isGraded) {
      if (totalPoints === undefined || totalPoints === null) {
        return res.status(400).json({
          success: false,
          message: 'Total points is required for graded discussions'
        });
      }
      const points = parseFloat(totalPoints);
      if (isNaN(points) || points <= 0 || points > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Total points must be a number between 1 and 1000'
        });
      }
      thread.totalPoints = points;
    } else {
      thread.totalPoints = null;
    }
    thread.group = group || thread.group;
    thread.dueDate = dueDate || thread.dueDate;
    if (module !== undefined) thread.module = module;
    if (groupSet !== undefined) thread.groupSet = groupSet;
    
    // Update settings if provided
    if (settings) {
      thread.settings = {
        requirePostBeforeSee: settings.requirePostBeforeSee !== undefined ? settings.requirePostBeforeSee : thread.settings.requirePostBeforeSee,
        allowLikes: settings.allowLikes !== undefined ? settings.allowLikes : thread.settings.allowLikes,
        allowComments: settings.allowComments !== undefined ? settings.allowComments : thread.settings.allowComments
      };
    }

    await thread.save();
    
    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    res.json({
      success: true,
      data: updatedThread
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating thread'
    });
  }
});

// Delete a thread
router.delete('/:threadId', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if user is authorized to delete
    if (!thread.author || !isAuthorized(req.user, thread.author, req.user.role === 'teacher')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this thread'
      });
    }

    await thread.deleteOne();

    res.json({
      success: true,
      message: 'Thread deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting thread'
    });
  }
});

// Grade a student's participation in a thread
router.post('/:threadId/grade', protect, authorize(['teacher', 'admin']), async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const { studentId, grade, feedback } = req.body;

    // Validate studentId
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid student ID is required'
      });
    }

    // Validate grade
    if (grade === undefined || grade === null) {
      return res.status(400).json({
        success: false,
        message: 'Grade is required'
      });
    }

    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum)) {
      return res.status(400).json({
        success: false,
        message: 'Grade must be a number'
      });
    }

    const thread = await Thread.findById(req.params.threadId);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    if (!thread.isGraded) {
      return res.status(400).json({
        success: false,
        message: 'This thread is not set up for grading'
      });
    }

    // Validate totalPoints exists
    if (!thread.totalPoints || thread.totalPoints <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Thread total points is not set or invalid'
      });
    }

    // Validate grade range
    if (gradeNum < 0 || gradeNum > thread.totalPoints) {
      return res.status(400).json({
        success: false,
        message: `Grade must be between 0 and ${thread.totalPoints}`
      });
    }

    // Find existing grade or create new one
    const gradeIndex = thread.studentGrades.findIndex(
      g => g.student.toString() === studentId
    );

    if (gradeIndex > -1) {
      // Update existing grade
      thread.studentGrades[gradeIndex] = {
        student: studentId,
        grade: gradeNum,
        feedback: feedback || null,
        gradedAt: new Date(),
        gradedBy: userId
      };
    } else {
      // Add new grade
      thread.studentGrades.push({
        student: studentId,
        grade: gradeNum,
        feedback: feedback || null,
        gradedAt: new Date(),
        gradedBy: userId
      });
    }

    await thread.save();

    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    res.json({
      success: true,
      data: updatedThread
    });
  } catch (error) {
    console.error('Error grading thread:', error);
    res.status(500).json({
      success: false,
      message: 'Error grading thread'
    });
  }
});

// Get a student's grade for a thread
router.get('/:threadId/grade/:studentId', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    // Validate studentId
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format'
      });
    }

    const thread = await Thread.findById(req.params.threadId)
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName');

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const grade = thread.studentGrades.find(
      g => g.student && g.student._id && g.student._id.toString() === req.params.studentId
    );

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'No grade found for this student'
      });
    }

    res.json({
      success: true,
      data: grade
    });
  } catch (error) {
    console.error('Error fetching grade:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching grade'
    });
  }
});

// Pin/Unpin a thread (teachers only)
router.patch('/:threadId/pin', protect, authorize(['teacher', 'admin']), async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    thread.isPinned = !thread.isPinned;
    await thread.save();

    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    res.json({
      success: true,
      data: updatedThread
    });
  } catch (error) {
    console.error('Error toggling thread pin status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating thread pin status'
    });
  }
});

// Get all threads for a module (both graded and non-graded)
router.get('/module/:moduleId', protect, async (req, res) => {
  try {
    // Validate moduleId
    if (!mongoose.Types.ObjectId.isValid(req.params.moduleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid module ID format'
      });
    }

    const threads = await Thread.find({ module: req.params.moduleId })
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      })
      .sort({ lastActivity: -1 });

    res.json({
      success: true,
      data: threads
    });
  } catch (error) {
    console.error('Error fetching module threads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching module discussion threads'
    });
  }
});

// Add publish/unpublish endpoint for threads (discussions)
router.patch('/threads/:id/publish', protect, authorize(['teacher', 'admin']), async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid thread ID format' 
      });
    }

    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }
    // Accept { published: true/false } in body, default to true if not provided
    const published = typeof req.body.published === 'boolean' ? req.body.published : true;
    thread.published = published;
    await thread.save();
    res.json({ success: true, data: thread });
  } catch (error) {
    console.error('Error publishing/unpublishing thread:', error);
    res.status(500).json({ success: false, message: 'Error publishing/unpublishing thread' });
  }
});

// Like/Unlike a reply
router.post('/:threadId/replies/:replyId/like', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    // Validate replyId
    if (!mongoose.Types.ObjectId.isValid(req.params.replyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reply ID format'
      });
    }

    // Validate user ID
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if likes are allowed
    if (!thread.settings || !thread.settings.allowLikes) {
      return res.status(400).json({
        success: false,
        message: 'Likes are not allowed for this discussion'
      });
    }

    const reply = thread.replies.id(req.params.replyId);
    
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: 'Reply not found'
      });
    }

    const existingLikeIndex = reply.likes.findIndex(
      like => like.user && like.user.toString() === userId.toString()
    );

    if (existingLikeIndex > -1) {
      // Unlike - remove the like
      reply.likes.splice(existingLikeIndex, 1);
    } else {
      // Like - add the like
      reply.likes.push({
        user: userId,
        likedAt: new Date()
      });
    }

    await thread.save();

    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    res.json({
      success: true,
      data: updatedThread
    });
  } catch (error) {
    console.error('Error liking/unliking reply:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating like status'
    });
  }
});

// Get thread with filtered replies based on user participation
router.get('/:threadId/participant/:userId', protect, async (req, res) => {
  try {
    // Validate threadId
    if (!mongoose.Types.ObjectId.isValid(req.params.threadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thread ID format'
      });
    }

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Validate current user ID
    const currentUserId = req.user._id || req.user.id;
    if (!currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const thread = await Thread.findById(req.params.threadId)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: [
          {
            path: 'author',
            select: 'firstName lastName role profilePicture'
          },
          {
            path: 'likes.user',
            select: 'firstName lastName'
          }
        ]
      });

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // If "require post before see" is enabled and user is a student
    if (thread.settings && thread.settings.requirePostBeforeSee && req.user.role === 'student') {
      // Check if the user has posted in this thread
      const userHasPosted = thread.replies && Array.isArray(thread.replies) && 
        thread.replies.some(reply => 
          reply.author && reply.author._id && reply.author._id.toString() === currentUserId.toString()
        );

      if (!userHasPosted && thread.author && thread.author._id) {
        // Filter out all replies except the original post
        thread.replies = thread.replies.filter(reply => 
          reply.author && reply.author._id && 
          reply.author._id.toString() === thread.author._id.toString()
        );
      }
    }

    res.json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error('Error fetching thread for participant:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching thread'
    });
  }
});

module.exports = router; 