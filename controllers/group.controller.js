const Group = require('../models/Group');
const User = require('../models/user.model');
const GroupSet = require('../models/GroupSet');
const Course = require('../models/course.model');

// Get all members of a group
exports.getGroupMembers = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).populate('members', 'firstName lastName email');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove a member from a group
exports.removeGroupMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    group.members = group.members.filter(
      memberId => memberId.toString() !== req.params.userId
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
    const search = req.query.search || '';
    // Find the group set and its course
    const groupSet = await GroupSet.findById(groupSetId).populate('course');
    if (!groupSet) return res.status(404).json({ message: 'Group set not found' });
    const course = await Course.findById(groupSet.course._id || groupSet.course);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    // Find all groups in this group set
    const groups = await Group.find({ groupSet: groupSetId });
    const membersInGroups = new Set();
    groups.forEach(g => g.members.forEach(m => membersInGroups.add(m.toString())));
    // Filter course students not in any group in this set
    let availableStudents = await User.find({
      _id: { $in: course.students.filter(sid => !membersInGroups.has(sid.toString())) },
      role: 'student',
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }).select('firstName lastName email');
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
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.members.includes(userId)) {
      return res.status(400).json({ message: 'User already in group' });
    }
    group.members.push(userId);
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
    
    // Find all courses where the user is enrolled as a student or is the instructor
    const userCourses = await Course.find({
      $or: [
        { students: userId },
        { instructor: userId }
      ]
    }).select('_id title');
    
    const courseIds = userCourses.map(course => course._id);
    
    // If no courses found, return empty array
    if (courseIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // Find all groups from these courses where the user is a member
    const groups = await Group.find({ 
      course: { $in: courseIds },
      members: userId  // Only show groups where the user is a member
    })
      .populate('course', 'title')
      .populate('members', 'firstName lastName email')
      .populate('leader', 'firstName lastName email');
    

    res.json({ success: true, data: groups });
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
    }).select('_id title');
    
    const courseIds = taughtCourses.map(course => course._id);
    
    // If no courses found, return empty array
    if (courseIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // Find all groupsets from these courses
    const groupSets = await GroupSet.find({ 
      course: { $in: courseIds }
    })
      .populate('course', 'title _id');
    

    res.json({ success: true, data: groupSets });
  } catch (err) {
    console.error('Error in getMyGroupSets:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ message: err.message });
  }
}; 