const Group = require('../models/Group');
const User = require('../models/user.model');
const GroupSet = require('../models/GroupSet');
const Course = require('../models/course.model');
const { isCourseGradingStaff } = require('../middleware/academicPermissions');

async function loadGroupWithCourse(groupId) {
  const group = await Group.findById(groupId).populate('groupSet');
  if (!group) return null;

  const courseRef = group.course || group.groupSet?.course;
  if (!courseRef) return { group, course: null };

  const courseId = courseRef._id || courseRef;
  const course = await Course.findById(courseId);
  return { group, course };
}

function isGroupMember(user, group) {
  return (group.members || []).some((memberId) => String(memberId) === String(user._id));
}

function canManageGroupRoster(user, course) {
  return course && isCourseGradingStaff(user, course);
}

// Get all members of a group
exports.getGroupMembers = async (req, res) => {
  try {
    const loaded = await loadGroupWithCourse(req.params.groupId);
    if (!loaded) return res.status(404).json({ message: 'Group not found' });

    const { group, course } = loaded;
    if (!canManageGroupRoster(req.user, course) && !isGroupMember(req.user, group)) {
      return res.status(403).json({ message: 'Not authorized to view group members' });
    }

    const populated = await Group.findById(group._id).populate(
      'members',
      'firstName lastName email profilePicture'
    );
    res.json(populated.members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove a member from a group
exports.removeGroupMember = async (req, res) => {
  try {
    const loaded = await loadGroupWithCourse(req.params.groupId);
    if (!loaded) return res.status(404).json({ message: 'Group not found' });

    const { group, course } = loaded;
    const removingSelf = String(req.params.userId) === String(req.user._id);
    if (!canManageGroupRoster(req.user, course) && !removingSelf) {
      return res.status(403).json({ message: 'Not authorized to remove group members' });
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== req.params.userId
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
    if (!canManageGroupRoster(req.user, course)) {
      return res.status(403).json({ message: 'Not authorized to view available students' });
    }
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
    const loaded = await loadGroupWithCourse(groupId);
    if (!loaded) return res.status(404).json({ message: 'Group not found' });

    const { group, course } = loaded;
    if (!canManageGroupRoster(req.user, course)) {
      return res.status(403).json({ message: 'Not authorized to modify group members' });
    }

    if (group.members.some((memberId) => String(memberId) === String(userId))) {
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

    const groupSetIds = filteredGroupSets.map((gs) => gs._id);
    const groups =
      groupSetIds.length > 0
        ? await Group.find({ groupSet: { $in: groupSetIds } }).select('groupSet members').lean()
        : [];

    const countsBySet = new Map();
    const allUniqueMembers = new Set();
    let totalGroups = 0;

    for (const group of groups) {
      totalGroups += 1;
      const setId = String(group.groupSet);
      if (!countsBySet.has(setId)) {
        countsBySet.set(setId, { totalGroups: 0, members: new Set() });
      }
      const entry = countsBySet.get(setId);
      entry.totalGroups += 1;
      for (const memberId of group.members || []) {
        const id = String(memberId);
        entry.members.add(id);
        allUniqueMembers.add(id);
      }
    }

    const data = filteredGroupSets.map((groupSet) => {
      const entry = countsBySet.get(String(groupSet._id)) || { totalGroups: 0, members: new Set() };
      const plain = groupSet.toObject();
      return {
        ...plain,
        totalGroups: entry.totalGroups,
        totalMembers: entry.members.size,
      };
    });

    res.json({
      success: true,
      data,
      stats: {
        totalGroupSets: data.length,
        totalGroups,
        totalMembers: allUniqueMembers.size,
        activeGroupSets: data.filter((gs) => gs.allowSelfSignup).length,
      },
    });
  } catch (err) {
    console.error('Error in getMyGroupSets:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ message: err.message });
  }
}; 