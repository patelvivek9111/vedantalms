const Group = require('../models/Group');
const User = require('../models/user.model');
const GroupSet = require('../models/GroupSet');
const Course = require('../models/course.model');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { asyncHandler } = require('../utils/errorHandler');
const { ValidationError, NotFoundError, UnauthorizedError } = require('../utils/errorHandler');

// Get all members of a group
exports.getGroupMembers = asyncHandler(async (req, res) => {
  // Validate groupId
  if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
    throw new ValidationError('Invalid group ID format');
  }
  
  const group = await Group.findById(req.params.groupId).populate('members', 'firstName lastName email profilePicture');
  if (!group) throw new NotFoundError('Group');
  res.json(group.members);
});

// Remove a member from a group
exports.removeGroupMember = asyncHandler(async (req, res) => {
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
    throw new ValidationError('Invalid group ID format');
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  
  const group = await Group.findById(req.params.groupId);
  if (!group) throw new NotFoundError('Group');
  
  // Use proper ObjectId comparison
  const userId = new mongoose.Types.ObjectId(req.params.userId);
  group.members = group.members.filter(
    memberId => memberId.toString() !== userId.toString()
  );
  await group.save();
  res.json({ message: 'Member removed' });
});

// Get available students for a group set (not in any group in the set)
exports.getAvailableStudentsForGroupSet = asyncHandler(async (req, res) => {
  const { groupSetId } = req.params;
  
  // Validate groupSetId
  if (!mongoose.Types.ObjectId.isValid(groupSetId)) {
    throw new ValidationError('Invalid group set ID format');
  }
  
  const search = req.query.search || '';
  // Find the group set and its course
  const groupSet = await GroupSet.findById(groupSetId).populate('course');
  if (!groupSet) throw new NotFoundError('Group set');
  
  const courseId = groupSet.course._id || groupSet.course;
  if (!courseId) throw new NotFoundError('Course not found in group set');
  
  const course = await Course.findById(courseId);
  if (!course) throw new NotFoundError('Course');
  
  // Find all groups in this group set
  const groups = await Group.find({ groupSet: groupSetId });
  const membersInGroups = new Set();
  groups.forEach(g => {
    if (g.members && Array.isArray(g.members)) {
      g.members.forEach(m => membersInGroups.add(m.toString()));
    }
  });
  
  // Filter course students not in any group in this set
  const availableStudentIds = course.students.filter(sid => !membersInGroups.has(sid.toString()));
  
  // Build search query
  const searchQuery = search.trim() ? {
    $or: [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ]
  } : {};
  
  let availableStudents = await User.find({
    _id: { $in: availableStudentIds },
    role: 'student',
    ...searchQuery
  }).select('firstName lastName email profilePicture');
  
  res.json(availableStudents);
});

// Add a member to a group
exports.addGroupMember = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;
  
  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new ValidationError('Invalid group ID format');
  }
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  
  const group = await Group.findById(groupId);
  if (!group) throw new NotFoundError('Group');
  
  // Use proper ObjectId comparison
  const userIdObj = new mongoose.Types.ObjectId(userId);
  const isAlreadyMember = group.members.some(m => m.toString() === userIdObj.toString());
  if (isAlreadyMember) {
    throw new ValidationError('User already in group');
  }
  
  // Verify user is enrolled in the course
  const course = await Course.findById(group.course);
  if (!course) {
    throw new NotFoundError('Course');
  }
  
  const isEnrolled = course.students.some(s => s.toString() === userIdObj.toString());
  if (!isEnrolled) {
    throw new ValidationError('User is not enrolled in this course');
  }
  
  group.members.push(userIdObj);
  await group.save();
  res.json({ message: 'Member added' });
});

// Get all groups for the current user
exports.getMyGroups = asyncHandler(async (req, res) => {
  // Check if user is authenticated
  if (!req.user || !req.user._id) {
    throw new UnauthorizedError('Authentication required');
  }
  
  const userId = req.user._id;
  const isStudent = req.user.role === 'student';
  
  // Find all courses where the user is enrolled as a student or is the instructor
  // For students, only get published courses; for teachers/admins, filter out unpublished courses
  const courseQuery = isStudent 
    ? {
        $or: [
          { students: userId },
          { instructor: userId }
        ],
        published: true // Students only see groups from published courses
      }
    : {
        $or: [
          { students: userId },
          { instructor: userId }
        ]
      };
  
  const userCourses = await Course.find(courseQuery).select('_id title published');
  
  const courseIds = userCourses.map(course => course._id);
  
  // If no courses found, return empty array
  if (courseIds.length === 0) {
    return res.json({ success: true, data: [] });
  }
  
  // Find all groups from these courses where the user is a member
  // Also filter by course published status if user is a student
  const groups = await Group.find({ 
    course: { $in: courseIds },
    members: userId  // Only show groups where the user is a member
  })
    .populate({
      path: 'course',
      select: 'title published'
    })
    .populate('members', 'firstName lastName email profilePicture')
    .populate('leader', 'firstName lastName email profilePicture');
  
  // Filter out groups from unpublished courses
  const filteredGroups = groups.filter(
    group => group.course && group.course.published !== false
  );

  res.json({ success: true, data: filteredGroups });
}); 

// Get all groupsets for courses the teacher teaches
exports.getMyGroupSets = asyncHandler(async (req, res) => {
  // Check if user is authenticated
  if (!req.user || !req.user._id) {
    throw new UnauthorizedError('Authentication required');
  }
  
  const userId = req.user._id;
  
  // Find all courses where the user is the instructor
  const taughtCourses = await Course.find({
    instructor: userId
  }).select('_id title published');
  
  const courseIds = taughtCourses.map(course => course._id);
  
  // If no courses found, return empty array
  if (courseIds.length === 0) {
    return res.json({ success: true, data: [] });
  }
  
  // Find all groupsets from these courses
  const groupSets = await GroupSet.find({ 
    course: { $in: courseIds }
  })
    .populate({
      path: 'course',
      select: 'title _id published'
    });
  
  // Filter out groupsets from unpublished courses
  const filteredGroupSets = groupSets.filter(
    groupSet => groupSet.course && groupSet.course.published !== false
  );

  res.json({ success: true, data: filteredGroupSets });
}); 