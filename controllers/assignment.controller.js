const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const { startOfWeek, endOfWeek } = require('date-fns');

// Create a new assignment
exports.createAssignment = async (req, res) => {
  try {
    const { title, description, moduleId, availableFrom, dueDate, questions, group } = req.body;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }
    if (!availableFrom) {
      return res.status(400).json({ message: 'Available from date is required' });
    }
    if (!dueDate) {
      return res.status(400).json({ message: 'Due date is required' });
    }
    
    // Validate that due date is after available from date
    const availableFromDate = new Date(availableFrom);
    const dueDateDate = new Date(dueDate);
    if (dueDateDate <= availableFromDate) {
      return res.status(400).json({ message: 'Due date must be after available from date' });
    }
    
    // Get file URLs from uploaded files
    const attachments = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    // Parse questions safely
    let parsedQuestions = [];
    if (questions) {
      try {
        parsedQuestions = JSON.parse(questions);
        if (!Array.isArray(parsedQuestions)) {
          return res.status(400).json({ message: 'Questions must be an array' });
        }
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid questions format. Must be valid JSON array.' });
      }
    }
    
    // Build assignment data object
    const assignmentData = {
      title,
      description,
      availableFrom,
      dueDate,
      attachments,
      createdBy: req.user._id,
      questions: parsedQuestions,
      isGroupAssignment: req.body.isGroupAssignment === 'true' || req.body.isGroupAssignment === true,
      groupSet: req.body.groupSet || null,
      group,
      isGradedQuiz: req.body.isGradedQuiz === 'true' || req.body.isGradedQuiz === true,
      isTimedQuiz: req.body.isTimedQuiz === 'true' || req.body.isTimedQuiz === true,
      quizTimeLimit: req.body.quizTimeLimit ? parseInt(req.body.quizTimeLimit) : null,
      allowStudentUploads: req.body.allowStudentUploads === 'true' || req.body.allowStudentUploads === true,
      displayMode: req.body.displayMode || 'single',
      showCorrectAnswers: req.body.showCorrectAnswers === 'true' || req.body.showCorrectAnswers === true,
      showStudentAnswers: req.body.showStudentAnswers === 'true' || req.body.showStudentAnswers === true,
      isOfflineAssignment: req.body.isOfflineAssignment === 'true' || req.body.isOfflineAssignment === true,
      totalPoints: req.body.totalPoints ? parseFloat(req.body.totalPoints) : 0
    };
    // Only set module for non-group assignments
    if (moduleId && !assignmentData.isGroupAssignment) {
      assignmentData.module = moduleId;
    }

    const assignment = new Assignment(assignmentData);

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    // If there's an error, delete any uploaded files
    if (req.files) {
      await Promise.all(req.files.map(file => 
        fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
      ));
    }
    res.status(500).json({ message: error.message });
  }
};

// Get all assignments for a module
exports.getModuleAssignments = async (req, res) => {
  try {
    const isStudent = req.user.role === 'student';
    const assignments = await Assignment.find({
      module: req.params.moduleId,
      ...(isStudent ? { published: true } : {})
    })
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 });
    // Add totalPoints to each assignment
    const assignmentsWithPoints = assignments.map(a => {
      // For offline assignments, use the stored totalPoints field
      // For regular assignments, calculate from questions
      let totalPoints = 0;
      if (a.isOfflineAssignment && a.totalPoints) {
        totalPoints = a.totalPoints;
      } else if (Array.isArray(a.questions) && a.questions.length > 0) {
        totalPoints = a.questions.reduce((sum, q) => sum + (q.points || 0), 0);
      } else if (a.totalPoints) {
        totalPoints = a.totalPoints;
      }
      const obj = a.toObject();
      obj.totalPoints = totalPoints;
      return obj;
    });
    res.json(assignmentsWithPoints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single assignment
exports.getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('createdBy', 'firstName lastName profilePicture')
      .populate('module', 'title');
      
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    // Always return just the assignment object, never attach a submission
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { title, description, availableFrom, dueDate, questions, group } = req.body;
    
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check if user is the creator
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this assignment' });
    }

    // Check if there are existing submissions
    const submissionCount = await Submission.countDocuments({ assignment: req.params.id });
    const hasSubmissions = submissionCount > 0;
    
    // Get new file URLs from uploaded files
    const newAttachments = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    // Delete old files if they exist
    if (assignment.attachments.length > 0) {
      await Promise.all(assignment.attachments.map(async (attachment) => {
        const filePath = path.join(__dirname, '..', attachment);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }));
    }
    
    // Validate dates if both are being updated
    if (availableFrom && dueDate) {
      const availableFromDate = new Date(availableFrom);
      const dueDateDate = new Date(dueDate);
      if (dueDateDate <= availableFromDate) {
        return res.status(400).json({ message: 'Due date must be after available from date' });
      }
    } else if (availableFrom && assignment.dueDate) {
      // Only availableFrom is being updated
      const availableFromDate = new Date(availableFrom);
      const dueDateDate = new Date(assignment.dueDate);
      if (dueDateDate <= availableFromDate) {
        return res.status(400).json({ message: 'Due date must be after available from date' });
      }
    } else if (dueDate && assignment.availableFrom) {
      // Only dueDate is being updated
      const availableFromDate = new Date(assignment.availableFrom);
      const dueDateDate = new Date(dueDate);
      if (dueDateDate <= availableFromDate) {
        return res.status(400).json({ message: 'Due date must be after available from date' });
      }
    }
    
    // Update the assignment
    assignment.title = title || assignment.title;
    assignment.description = description || assignment.description;
    assignment.availableFrom = availableFrom || assignment.availableFrom;
    assignment.dueDate = dueDate || assignment.dueDate;
    assignment.attachments = newAttachments.length > 0 ? newAttachments : assignment.attachments;
    if (group !== undefined) assignment.group = group;
    if (req.body.isGradedQuiz !== undefined) assignment.isGradedQuiz = req.body.isGradedQuiz === 'true' || req.body.isGradedQuiz === true;
    if (req.body.isTimedQuiz !== undefined) assignment.isTimedQuiz = req.body.isTimedQuiz === 'true' || req.body.isTimedQuiz === true;
    if (req.body.quizTimeLimit !== undefined) assignment.quizTimeLimit = req.body.quizTimeLimit ? parseInt(req.body.quizTimeLimit) : null;
    if (req.body.allowStudentUploads !== undefined) assignment.allowStudentUploads = req.body.allowStudentUploads === 'true' || req.body.allowStudentUploads === true;
    if (req.body.displayMode !== undefined) assignment.displayMode = req.body.displayMode;
    if (req.body.showCorrectAnswers !== undefined) assignment.showCorrectAnswers = req.body.showCorrectAnswers === 'true' || req.body.showCorrectAnswers === true;
    if (req.body.showStudentAnswers !== undefined) assignment.showStudentAnswers = req.body.showStudentAnswers === 'true' || req.body.showStudentAnswers === true;
    if (req.body.isOfflineAssignment !== undefined) assignment.isOfflineAssignment = req.body.isOfflineAssignment === 'true' || req.body.isOfflineAssignment === true;
    if (req.body.totalPoints !== undefined) assignment.totalPoints = req.body.totalPoints ? parseFloat(req.body.totalPoints) : 0;
    
    // Update questions if provided
    if (questions) {
      try {
        const parsedQuestions = JSON.parse(questions);
        // Validate questions structure
        if (Array.isArray(parsedQuestions)) {
          // If there are submissions, check for critical changes
          if (hasSubmissions) {
            const oldQuestions = assignment.questions || [];
            const newQuestions = parsedQuestions;
            
            // Check if questions were added or removed
            if (newQuestions.length !== oldQuestions.length) {
              return res.status(400).json({ 
                message: 'Cannot add or remove questions after students have submitted. You can only modify question text, options, or points.',
                submissionCount: submissionCount
              });
            }
            
            // Check if question types were changed
            for (let i = 0; i < newQuestions.length; i++) {
              if (oldQuestions[i] && oldQuestions[i].type !== newQuestions[i].type) {
                return res.status(400).json({ 
                  message: 'Cannot change question types after students have submitted. You can only modify question text, options, or points.',
                  submissionCount: submissionCount
                });
              }
            }
          }
          
          assignment.questions = parsedQuestions.map(q => ({
            id: q.id || new mongoose.Types.ObjectId().toString(),
            type: q.type,
            text: q.text,
            points: q.points,
            options: q.type === 'multiple-choice' ? q.options.map(opt => ({
              text: opt.text,
              isCorrect: opt.isCorrect
            })) : undefined,
            // Handle matching questions
            leftItems: q.type === 'matching' && q.leftItems ? q.leftItems.map(item => ({
              id: item.id || new mongoose.Types.ObjectId().toString(),
              text: item.text
            })) : undefined,
            rightItems: q.type === 'matching' && q.rightItems ? q.rightItems.map(item => ({
              id: item.id || new mongoose.Types.ObjectId().toString(),
              text: item.text
            })) : undefined
          }));
        }
      } catch (err) {
        console.error('Error parsing questions:', err);
        return res.status(400).json({ message: 'Invalid questions format' });
      }
    }
    
    await assignment.save();
    res.json({
      success: true,
      data: assignment,
      submissionCount: submissionCount,
      hasSubmissions: hasSubmissions
    });
  } catch (error) {
    // If there's an error, delete any uploaded files
    if (req.files) {
      await Promise.all(req.files.map(file => 
        fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
      ));
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete an assignment
exports.deleteAssignment = async (req, res) => {
  try {

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      console.error('[DeleteAssignment] Assignment not found:', req.params.id);
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (!assignment.createdBy) {
      console.error('[DeleteAssignment] Assignment has no creator:', assignment);
      return res.status(500).json({ message: 'Assignment has no creator. Cannot verify permissions.' });
    }
    // Check if user is the creator
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      console.error('[DeleteAssignment] Not authorized. Assignment creator:', assignment.createdBy, 'User:', req.user._id);
      return res.status(403).json({ message: 'Not authorized to delete this assignment' });
    }
    // Delete all files
    if (Array.isArray(assignment.attachments) && assignment.attachments.length > 0) {
      await Promise.all(assignment.attachments.map(async (attachment) => {
        const filePath = path.join(__dirname, '..', attachment);
        try {
          await fs.unlink(filePath);

        } catch (err) {
          console.error('[DeleteAssignment] Error deleting file:', filePath, err.message);
        }
      }));
    } else {
      
    }
    // Delete all submissions for this assignment
    try {
      const result = await Submission.deleteMany({ assignment: req.params.id });

    } catch (err) {
      console.error('[DeleteAssignment] Error deleting submissions:', err.message);
    }
    try {
      await assignment.deleteOne();

      res.json({ message: 'Assignment deleted successfully' });
    } catch (removeError) {
      console.error('[DeleteAssignment] Error removing assignment:', removeError);
      res.status(500).json({ message: 'Error removing assignment', error: removeError.message });
    }
  } catch (error) {
    console.error('[DeleteAssignment] Unexpected error:', error);
    res.status(500).json({ message: 'Server error during assignment deletion', error: error.message });
  }
};

// Toggle publish status of an assignment
exports.toggleAssignmentPublish = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    assignment.published = !assignment.published;
    await assignment.save();
    res.json({ success: true, published: assignment.published });
  } catch (err) {
    console.error('Toggle assignment publish error:', err);
    res.status(500).json({ success: false, message: 'Server error during publish toggle', error: err.message });
  }
};

// Get all group assignments for a group set
exports.getGroupSetAssignments = async (req, res) => {
  try {
    const groupSetId = req.params.groupSetId;
    const assignments = await Assignment.find({
      isGroupAssignment: true,
      groupSet: groupSetId
    })
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all group assignments for a course
exports.getCourseGroupAssignments = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const isStudent = req.user.role === 'student';
    // Find all group assignments for the course by finding assignments with groupSet
    // that belongs to the course
    const assignments = await Assignment.find({
      isGroupAssignment: true,
      groupSet: { $ne: null }
    })
      .populate({ 
        path: 'groupSet', 
        match: { course: courseId },
        select: 'name course'
      })
      .populate('createdBy', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 });
    const courseGroupAssignments = assignments.filter(assignment => assignment.groupSet);
    if (courseGroupAssignments.length > 0) {
    }
    // Apply student filter if needed
    const filteredAssignments = isStudent 
      ? courseGroupAssignments.filter(assignment => assignment.published)
      : courseGroupAssignments;
    res.json(filteredAssignments);
  } catch (error) {
    console.error('Error in getCourseGroupAssignments:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all assignments with ungraded submissions for the logged-in teacher/admin
exports.getUngradedAssignmentsTodo = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    // 1. Find all courses where the user is the instructor
    const courses = await require('../models/course.model').find({ instructor: userId });
    const courseIds = courses.map(c => c._id);
    // 2. For each course, find all modules
    const modules = await require('../models/module.model').find({ course: { $in: courseIds } });
    const moduleIds = modules.map(m => m._id);
    // 3. For each module, find all assignments
    const assignments = await require('../models/Assignment').find({ module: { $in: moduleIds } });
    // 4. For each assignment, count ungraded submissions
    const results = [];
    for (const assignment of assignments) {
      const ungradedCount = await Submission.countDocuments({ assignment: assignment._id, $or: [ { grade: null }, { grade: { $exists: false } } ] });
      if (ungradedCount > 0) {
        // Find course for this assignment
        const module = modules.find(m => m._id.toString() === assignment.module.toString());
        const course = courses.find(c => c._id.toString() === module.course.toString());
        results.push({
          id: assignment._id,
          title: assignment.title,
          course: { id: course._id, title: course.title },
          ungradedCount
        });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Error in getUngradedAssignmentsTodo:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get assignments due this week for the current student
exports.getStudentAssignmentsDueThisWeek = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    // First, get all courses the student is enrolled in
    const Course = require('../models/course.model');
    const courses = await Course.find({ students: userId, published: true }).select('_id');
    const courseIds = courses.map(c => c._id);
    
    // Get all modules for these courses
    const Module = require('../models/module.model');
    const modules = await Module.find({ course: { $in: courseIds } }).select('_id');
    const moduleIds = modules.map(m => m._id);
    
    // Find assignments where dueDate is this week, user is enrolled, and assignment is published
    const assignments = await Assignment.find({
      module: { $in: moduleIds },
      dueDate: { $gte: weekStart, $lte: weekEnd },
      published: true,
    })
      .populate({
        path: 'module',
        populate: {
          path: 'course',
          select: 'title'
        }
      })
      .sort({ dueDate: 1 })
      .lean();
    
    // Filter out assignments already submitted by this student
    const Submission = require('../models/Submission');
    const Group = require('../models/Group');
    
    // Get individual submissions by this student
    const individualSubmissions = await Submission.find({ 
      student: userId,
      group: { $exists: false }
    }).distinct('assignment');
    
    // Get group submissions where this student is a member
    const userGroups = await Group.find({ members: userId }).distinct('_id');
    const groupSubmissions = await Submission.find({ 
      group: { $in: userGroups }
    }).distinct('assignment');
    
    
    
    // Combine all submitted assignment IDs
    const submittedIds = new Set([
      ...individualSubmissions.map(id => id.toString()),
      ...groupSubmissions.map(id => id.toString())
    ]);
    
    
    
    const filtered = assignments.filter(a => !submittedIds.has(a._id.toString()));
    
    
    
    res.json(filtered);
  } catch (err) {
    console.error('Error in getStudentAssignmentsDueThisWeek:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all items due this week for the current student (assignments + discussions)
exports.getAllItemsDueThisWeek = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    // First, get all courses the student is enrolled in
    const Course = require('../models/course.model');
    const courses = await Course.find({ students: userId, published: true }).select('_id');
    const courseIds = courses.map(c => c._id);
    
    // Get all modules for these courses
    const Module = require('../models/module.model');
    const modules = await Module.find({ course: { $in: courseIds } }).select('_id');
    const moduleIds = modules.map(m => m._id);
    
    // Find assignments where dueDate is this week, user is enrolled, and assignment is published
    const assignments = await Assignment.find({
      module: { $in: moduleIds },
      dueDate: { $gte: weekStart, $lte: weekEnd },
      published: true,
    })
      .populate({
        path: 'module',
        populate: {
          path: 'course',
          select: 'title'
        }
      })
      .sort({ dueDate: 1 })
      .lean();
    
    // Find discussions where dueDate is this week and user is enrolled
    const Thread = require('../models/thread.model');
    const discussions = await Thread.find({
      module: { $in: moduleIds },
      dueDate: { $gte: weekStart, $lte: weekEnd },
      published: true,
    })
      .populate({
        path: 'module',
        populate: {
          path: 'course',
          select: 'title'
        }
      })
      .populate('course', 'title')
      .sort({ dueDate: 1 })
      .lean();
    
    // Filter out assignments already submitted by this student
    const Submission = require('../models/Submission');
    const Group = require('../models/Group');
    
    // Get individual submissions by this student
    const individualSubmissions = await Submission.find({ 
      student: userId,
      group: { $exists: false }
    }).distinct('assignment');
    
    // Get group submissions where this student is a member
    const userGroups = await Group.find({ members: userId }).distinct('_id');
    const groupSubmissions = await Submission.find({ 
      group: { $in: userGroups }
    }).distinct('assignment');
    
    // Combine all submitted assignment IDs
    const submittedIds = new Set([
      ...individualSubmissions.map(id => id.toString()),
      ...groupSubmissions.map(id => id.toString())
    ]);
    
    // Filter out submitted assignments
    const filteredAssignments = assignments.filter(a => !submittedIds.has(a._id.toString()));
    
    // Filter out discussions where student has already posted
    const filteredDiscussions = discussions.filter(d => {
      // Check if student has posted in this discussion
      const hasPosted = d.replies && d.replies.some(reply => 
        reply.author && reply.author.toString() === userId.toString()
      );
      return !hasPosted;
    });
    
    // Combine and format results
    const allItems = [
      ...filteredAssignments.map(item => ({
        ...item,
        type: 'assignment',
        itemType: 'Assignment'
      })),
      ...filteredDiscussions.map(item => ({
        ...item,
        type: 'discussion',
        itemType: 'Discussion',
        module: item.module || { course: item.course }
      }))
    ].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    res.json(allItems);
  } catch (err) {
    console.error('Error in getAllItemsDueThisWeek:', err);
    res.status(500).json({ error: err.message });
  }
}; 

// Get assignment statistics for teachers
exports.getAssignmentStats = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const assignment = await Assignment.findById(assignmentId);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Get all submissions for this assignment
    const submissions = await Submission.find({ assignment: assignmentId })
      .populate('student', 'firstName lastName')
      .populate('group', 'name');

    // Calculate basic statistics
    const totalStudents = submissions.length;
    const submittedCount = submissions.filter(s => s.submittedAt).length;
    const averageGrade = totalStudents > 0 
      ? submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / totalStudents 
      : 0;
    const averageTime = assignment.isTimedQuiz && totalStudents > 0
      ? submissions.reduce((sum, s) => sum + (s.timeSpent || 0), 0) / totalStudents
      : 0;

    // Calculate engagement metrics
    const engagementStats = {
      // Average time spent (for timed quizzes)
      averageTimeSpent: assignment.isTimedQuiz && totalStudents > 0
        ? submissions.reduce((sum, s) => sum + (s.timeSpent || 0), 0) / totalStudents
        : 0,
      
      // Attempts per student (count submissions per student)
      averageAttemptsPerStudent: totalStudents > 0
        ? submissions.length / totalStudents
        : 0,
      
      // Student activity patterns (submission times)
      submissionTimePatterns: submissions
        .filter(s => s.submittedAt)
        .map(s => ({
          hour: new Date(s.submittedAt).getHours(),
          dayOfWeek: new Date(s.submittedAt).getDay(),
          isLate: new Date(s.submittedAt) > new Date(assignment.dueDate)
        }))
    };

    // Calculate activity peak hours
    const hourCounts = {};
    engagementStats.submissionTimePatterns.forEach(pattern => {
      hourCounts[pattern.hour] = (hourCounts[pattern.hour] || 0) + 1;
    });
    const peakHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[a] > hourCounts[b] ? a : b, 0
    );

    // Calculate activity peak days
    const dayCounts = {};
    engagementStats.submissionTimePatterns.forEach(pattern => {
      dayCounts[pattern.dayOfWeek] = (dayCounts[pattern.dayOfWeek] || 0) + 1;
    });
    const peakDay = Object.keys(dayCounts).reduce((a, b) => 
      dayCounts[a] > dayCounts[b] ? a : b, 0
    );

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Calculate question statistics
    const questionStats = assignment.questions?.map((q, index) => {
      const questionSubmissions = submissions.filter(s => s.answers && s.answers[index]);
      const correctCount = questionSubmissions.filter(s => {
        const answer = s.answers[index];
        if (q.type === 'multiple-choice') {
          return answer === q.options.find(opt => opt.isCorrect)?.text;
        }
        return false; // For other question types, we can't determine correctness automatically
      }).length;
      
      return {
        questionIndex: index,
        correctCount,
        incorrectCount: questionSubmissions.length - correctCount,
        averagePoints: questionSubmissions.length > 0 
          ? (correctCount / questionSubmissions.length) * (q.points || 0)
          : 0
      };
    }) || [];

    const stats = {
      totalStudents,
      submittedCount,
      averageGrade,
      averageTime,
      questionStats,
      engagementStats: {
        averageTimeSpent: engagementStats.averageTimeSpent,
        averageAttemptsPerStudent: engagementStats.averageAttemptsPerStudent,
        peakHour: parseInt(peakHour),
        peakDay: dayNames[parseInt(peakDay)],
        lateSubmissions: engagementStats.submissionTimePatterns.filter(p => p.isLate).length,
        totalSubmissions: engagementStats.submissionTimePatterns.length
      }
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting assignment stats:', error);
    res.status(500).json({ message: 'Error fetching assignment statistics' });
  }
}; 