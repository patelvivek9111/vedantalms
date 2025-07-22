const express = require('express');
const router = express.Router();
const Thread = require('../models/thread.model');
const { protect, authorize } = require('../middleware/auth');

// Helper function to check if user is authorized to modify content
const isAuthorized = (user, contentAuthor, isTeacher) => {
  return user._id.toString() === contentAuthor.toString() || isTeacher;
};

// Get all threads for a course
router.get('/course/:courseId', protect, async (req, res) => {
  try {
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
    const { title, content, courseId, module, isGraded, totalPoints, group, dueDate, groupSet } = req.body;
    
    const thread = new Thread({
      title,
      content,
      course: courseId,
      author: req.user._id,
      module: module || undefined,
      groupSet: groupSet || undefined,
      isGraded: isGraded || false,
      totalPoints: isGraded ? totalPoints : null,
      group: group || 'Discussions',
      dueDate: dueDate || null
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
    const thread = await Thread.findById(req.params.threadId)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'firstName lastName role profilePicture'
        }
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
    const { content, parentReply } = req.body;
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
      content,
      author: req.user._id,
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
        populate: {
          path: 'author',
          select: 'firstName lastName role profilePicture'
        }
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
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if user is authorized to edit
    if (!isAuthorized(req.user, thread.author, req.user.role === 'teacher')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this thread'
      });
    }

    const { title, content, isGraded, totalPoints, group, dueDate, module, groupSet } = req.body;
    thread.title = title || thread.title;
    thread.content = content || thread.content;
    thread.isGraded = isGraded !== undefined ? isGraded : thread.isGraded;
    thread.totalPoints = isGraded ? totalPoints : null;
    thread.group = group || thread.group;
    thread.dueDate = dueDate || thread.dueDate;
    if (module !== undefined) thread.module = module;
    if (groupSet !== undefined) thread.groupSet = groupSet;

    await thread.save();
    
    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate('groupSet', 'name')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'firstName lastName role profilePicture'
        }
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
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Check if user is authorized to delete
    if (!isAuthorized(req.user, thread.author, req.user.role === 'teacher')) {
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
    const { studentId, grade, feedback } = req.body;
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

    // Validate grade
    if (grade < 0 || grade > thread.totalPoints) {
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
        grade,
        feedback,
        gradedAt: new Date(),
        gradedBy: req.user._id
      };
    } else {
      // Add new grade
      thread.studentGrades.push({
        student: studentId,
        grade,
        feedback,
        gradedAt: new Date(),
        gradedBy: req.user._id
      });
    }

    await thread.save();

    const updatedThread = await Thread.findById(thread._id)
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'firstName lastName role profilePicture'
        }
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
      g => g.student._id.toString() === req.params.studentId
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
        populate: {
          path: 'author',
          select: 'firstName lastName role profilePicture'
        }
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

// Get all graded threads for a module
router.get('/module/:moduleId', protect, async (req, res) => {
  try {
    const threads = await Thread.find({ module: req.params.moduleId, isGraded: true })
      .populate('author', 'firstName lastName role profilePicture')
      .populate('studentGrades.student', 'firstName lastName')
      .populate('studentGrades.gradedBy', 'firstName lastName')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: '_id firstName lastName role profilePicture'
        }
      })
      .sort({ dueDate: 1 });

    res.json(threads);
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

module.exports = router; 