const mongoose = require('mongoose');
const Poll = require('../models/poll.model');
const Course = require('../models/course.model');
const logger = require('../utils/logger');

// Create a new poll
const createPoll = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, options, endDate, allowMultipleVotes, resultsVisible } = req.body;
    const userId = req.user._id || req.user.id;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Validate course exists and user is instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can create polls'
      });
    }

    // Validate options
    if (!options || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 options are required'
      });
    }

    // Validate end date
    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date is required'
      });
    }
    
    const endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end date format'
      });
    }
    
    if (endDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'End date must be in the future'
      });
    }

    // Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const poll = new Poll({
      course: courseId,
      title: title.trim(),
      options: options.map(option => ({ text: typeof option === 'string' ? option.trim() : String(option).trim(), votes: 0 })),
      createdBy: userId,
      endDate: endDateObj,
      allowMultipleVotes: allowMultipleVotes || false,
      resultsVisible: resultsVisible || false
    });

    await poll.save();

    res.status(201).json({
      success: true,
      message: 'Poll created successfully',
      data: poll
    });
  } catch (error) {
    logger.logError(error, { action: 'createPoll', courseId: req.params.courseId });
    res.status(500).json({
      success: false,
      message: 'Error creating poll',
      error: error.message
    });
  }
};

// Get all polls for a course
const getPollsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { user } = req;
    const userId = user._id || user.id;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course ID format'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to the course
    const isInstructor = course.instructor.toString() === userId.toString();
    const isStudent = course.students.some(student => student.toString() === userId.toString());
    const isAdmin = user.role === 'admin';

    if (!isInstructor && !isStudent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this course'
      });
    }

    const polls = await Poll.find({ course: courseId })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Automatically mark expired polls as inactive
    const now = new Date();
    for (const poll of polls) {
      if (poll.isActive && poll.isExpired()) {
        poll.isActive = false;
        await poll.save();
      }
    }

    // For students, only show active polls and hide results until they vote
    const filteredPolls = polls.map(poll => {
      const pollObj = poll.toObject();
      
      if (user.role === 'student') {
        // Check if student has voted
        const studentVote = poll.studentVotes.find(vote => 
          vote.student.toString() === userId.toString()
        );
        pollObj.hasVoted = !!studentVote;
        pollObj.studentVote = studentVote;
        
        // Hide results until student has voted OR if poll is expired
        if (!studentVote && !poll.isExpired()) {
          pollObj.options = pollObj.options.map(option => ({
            ...option,
            votes: undefined // Hide vote counts
          }));
          pollObj.totalVotes = undefined; // Hide total votes
        } else {
          // Ensure totalVotes is calculated when results are visible
          pollObj.totalVotes = poll.totalVotes;
        }
      } else {
        // For instructors and admins, always show results and ensure totalVotes is calculated
        pollObj.hasVoted = false; // Teachers don't vote
        pollObj.totalVotes = poll.totalVotes;
      }
      
      return pollObj;
    });

    res.json({
      success: true,
      data: filteredPolls
    });
  } catch (error) {
    logger.logError(error, { action: 'getPolls', courseId: req.params.courseId });
    res.status(500).json({
      success: false,
      message: 'Error fetching polls',
      error: error.message
    });
  }
};

// Vote on a poll
const voteOnPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { selectedOptions } = req.body;
    const { user } = req;
    const userId = user._id || user.id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid poll ID format'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Validate poll exists
    const poll = await Poll.findById(pollId).populate('course');
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if poll is active
    if (!poll.isActive || poll.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'Poll is not active or has expired'
      });
    }

    // Check if user is a student in the course
    const course = poll.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this poll'
      });
    }
    
    const isStudent = course.students.some(student => student.toString() === userId.toString());
    if (!isStudent) {
      return res.status(403).json({
        success: false,
        message: 'Only enrolled students can vote'
      });
    }

    // Check if student has already voted (unless multiple votes allowed)
    const existingVote = poll.studentVotes.find(vote => 
      vote.student.toString() === userId.toString()
    );
    if (existingVote && !poll.allowMultipleVotes) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted on this poll'
      });
    }

    // Validate selected options
    if (!selectedOptions || !Array.isArray(selectedOptions) || selectedOptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one option must be selected'
      });
    }

    // Check if multiple votes are allowed
    if (!poll.allowMultipleVotes && selectedOptions.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Multiple votes are not allowed for this poll'
      });
    }

    // Validate option indices
    const validIndices = selectedOptions.every(index => 
      typeof index === 'number' && index >= 0 && index < poll.options.length && Number.isInteger(index)
    );
    if (!validIndices) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option selected'
      });
    }

    // Check for duplicate options if multiple votes not allowed
    if (!poll.allowMultipleVotes && selectedOptions.length > 1) {
      const uniqueOptions = new Set(selectedOptions);
      if (uniqueOptions.size !== selectedOptions.length) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate options are not allowed'
        });
      }
    }

    // Add vote
    poll.studentVotes.push({
      student: userId,
      selectedOptions,
      votedAt: new Date()
    });

    // Update vote counts
    selectedOptions.forEach(optionIndex => {
      poll.options[optionIndex].votes += 1;
    });

    await poll.save();

    res.json({
      success: true,
      message: 'Vote recorded successfully',
      data: poll
    });
  } catch (error) {
    logger.logError(error, { action: 'votePoll', pollId: req.params.pollId });
    res.status(500).json({
      success: false,
      message: 'Error recording vote',
      error: error.message
    });
  }
};

// Get poll results (for instructors and admins)
const getPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { user } = req;
    const userId = user._id || user.id;

    // Validate pollId
    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid poll ID format'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const poll = await Poll.findById(pollId)
      .populate('course')
      .populate('studentVotes.student', 'firstName lastName email');

    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if user is instructor or admin
    const course = poll.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this poll'
      });
    }
    
    const isInstructor = course.instructor.toString() === userId.toString();
    const isAdmin = user.role === 'admin';

    if (!isInstructor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view detailed results'
      });
    }

    const results = {
      ...poll.toObject(),
      totalVotes: poll.totalVotes,
      winningOptions: poll.getWinningOptions(),
      isExpired: poll.isExpired()
    };

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.logError(error, { action: 'getPollResults', pollId: req.params.pollId });
    res.status(500).json({
      success: false,
      message: 'Error fetching poll results',
      error: error.message
    });
  }
};

// Update poll (for instructors)
const updatePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { title, endDate, isActive, resultsVisible } = req.body;
    const { user } = req;
    const userId = user._id || user.id;

    // Validate pollId
    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid poll ID format'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const poll = await Poll.findById(pollId).populate('course');
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if user is the instructor
    const course = poll.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this poll'
      });
    }
    
    if (course.instructor.toString() !== userId.toString() && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can update polls'
      });
    }

    // Update fields
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty'
        });
      }
      poll.title = title.trim();
    }
    
    if (endDate) {
      const endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end date format'
        });
      }
      if (endDateObj <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'End date must be in the future'
        });
      }
      poll.endDate = endDateObj;
    }
    
    if (typeof isActive === 'boolean') poll.isActive = isActive;
    if (typeof resultsVisible === 'boolean') poll.resultsVisible = resultsVisible;

    await poll.save();

    res.json({
      success: true,
      message: 'Poll updated successfully',
      data: poll
    });
  } catch (error) {
    logger.logError(error, { action: 'updatePoll', pollId: req.params.pollId });
    res.status(500).json({
      success: false,
      message: 'Error updating poll',
      error: error.message
    });
  }
};

// Delete poll (for instructors)
const deletePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { user } = req;
    const userId = user._id || user.id;

    // Validate pollId
    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid poll ID format'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const poll = await Poll.findById(pollId).populate('course');
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if user is the instructor
    const course = poll.course;
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found for this poll'
      });
    }
    
    if (course.instructor.toString() !== userId.toString() && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can delete polls'
      });
    }

    await Poll.findByIdAndDelete(pollId);

    res.json({
      success: true,
      message: 'Poll deleted successfully'
    });
  } catch (error) {
    logger.logError(error, { action: 'deletePoll', pollId: req.params.pollId });
    res.status(500).json({
      success: false,
      message: 'Error deleting poll',
      error: error.message
    });
  }
};

module.exports = {
  createPoll,
  getPollsByCourse,
  voteOnPoll,
  getPollResults,
  updatePoll,
  deletePoll
}; 