const Group = require('../models/Group');
const User = require('../models/user.model');
const GroupSet = require('../models/GroupSet');
const Course = require('../models/course.model');

// Get all members of a group
exports.getGroupMembers = async (req, res) => {
  try {
    // Validate groupId
    if (!require('mongoose').Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    
    const group = await Group.findById(req.params.groupId).populate('members', 'firstName lastName email profilePicture');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove a member from a group
exports.removeGroupMember = async (req, res) => {
  try {
    // Validate IDs
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    // Use proper ObjectId comparison
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    group.members = group.members.filter(
      memberId => memberId.toString() !== userId.toString()
    );
    await group.save();
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get available students for a group set (not in any group in the set)
exports.getAvailableStudentsForGroupSet = async (req, res) => {
  try {
    const { groupSetId } = req.params;
    const mongoose = require('mongoose');
    
    // Validate groupSetId
    if (!mongoose.Types.ObjectId.isValid(groupSetId)) {
      return res.status(400).json({ message: 'Invalid group set ID format' });
    }
    
    const search = req.query.search || '';
    // Find the group set and its course
    const groupSet = await GroupSet.findById(groupSetId).populate('course');
    if (!groupSet) return res.status(404).json({ message: 'Group set not found' });
    
    const courseId = groupSet.course._id || groupSet.course;
    if (!courseId) return res.status(404).json({ message: 'Course not found in group set' });
    
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    
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
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add a member to a group
exports.addGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const mongoose = require('mongoose');
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    // Use proper ObjectId comparison
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const isAlreadyMember = group.members.some(m => m.toString() === userIdObj.toString());
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User already in group' });
    }
    
    // Verify user is enrolled in the course
    const course = await Course.findById(group.course);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    const isEnrolled = course.students.some(s => s.toString() === userIdObj.toString());
    if (!isEnrolled) {
      return res.status(400).json({ message: 'User is not enrolled in this course' });
    }
    
    group.members.push(userIdObj);
    await group.save();
    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all groups for the current user
exports.getMyGroups = async (req, res) => {
  try {
  
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
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
  } catch (err) {
    console.error('Error in getMyGroups:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ message: err.message });
  }
}; 

// Get all groupsets for courses the teacher teaches
exports.getMyGroupSets = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
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
  } catch (err) {
    console.error('Error in getMyGroupSets:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ message: err.message });
  }
}; 