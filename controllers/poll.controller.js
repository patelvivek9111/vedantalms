const Poll = require('../models/poll.model');
const Course = require('../models/course.model');

// Create a new poll
const createPoll = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, options, endDate, allowMultipleVotes, resultsVisible } = req.body;

    // Validate course exists and user is instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
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
    const endDateObj = new Date(endDate);
    if (endDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'End date must be in the future'
      });
    }

    const poll = new Poll({
      course: courseId,
      title,
      options: options.map(option => ({ text: option, votes: 0 })),
      createdBy: req.user.id,
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
    console.error('Create poll error:', error);
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

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to the course
    const isInstructor = course.instructor.toString() === user.id;
    const isStudent = course.students.some(student => student.toString() === user.id);
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
          vote.student.toString() === user.id
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
    console.error('Get polls error:', error);
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
    const isStudent = course.students.some(student => student.toString() === user.id);
    if (!isStudent) {
      return res.status(403).json({
        success: false,
        message: 'Only enrolled students can vote'
      });
    }

    // Check if student has already voted
    const existingVote = poll.studentVotes.find(vote => 
      vote.student.toString() === user.id
    );
    if (existingVote) {
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
      index >= 0 && index < poll.options.length
    );
    if (!validIndices) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option selected'
      });
    }

    // Add vote
    poll.studentVotes.push({
      student: user.id,
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
    console.error('Vote error:', error);
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
    const isInstructor = course.instructor.toString() === user.id;
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
    console.error('Get poll results error:', error);
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

    const poll = await Poll.findById(pollId).populate('course');
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if user is the instructor
    const course = poll.course;
    if (course.instructor.toString() !== user.id && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only course instructors can update polls'
      });
    }

    // Update fields
    if (title) poll.title = title;
    if (endDate) poll.endDate = new Date(endDate);
    if (typeof isActive === 'boolean') poll.isActive = isActive;
    if (typeof resultsVisible === 'boolean') poll.resultsVisible = resultsVisible;

    await poll.save();

    res.json({
      success: true,
      message: 'Poll updated successfully',
      data: poll
    });
  } catch (error) {
    console.error('Update poll error:', error);
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

    const poll = await Poll.findById(pollId).populate('course');
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    // Check if user is the instructor
    const course = poll.course;
    if (course.instructor.toString() !== user.id && user.role !== 'admin') {
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
    console.error('Delete poll error:', error);
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