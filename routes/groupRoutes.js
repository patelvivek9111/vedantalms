const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const GroupSet = require('../models/GroupSet.js');
const Group = require('../models/Group.js');
const Thread = require('../models/thread.model.js');
const Course = require('../models/course.model.js');
const Submission = require('../models/Submission.js');
const groupController = require('../controllers/group.controller');

// Add this route for getting all groups for the current user (must be before any parameterized routes)
router.get('/my', protect, groupController.getMyGroups);

// Add this route for getting all groupsets for courses the teacher teaches
router.get('/sets/my', protect, authorize('teacher', 'admin'), groupController.getMyGroupSets);

// Group Set Routes
router.post('/sets', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { name, courseId, allowSelfSignup, groupStructure, groupCount, studentsPerGroup } = req.body;
        
        // Validate inputs
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Group set name is required' });
        }
        if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ error: 'Valid course ID is required' });
        }
        
        // Verify course exists and user is instructor
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        const userId = req.user._id || req.user.id;
        if (course.instructor.toString() !== userId.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to create groups for this course' });
        }
        
        const groupSet = new GroupSet({
            name,
            course: courseId,
            allowSelfSignup,
            groupStructure: groupStructure || 'manual'
        });
        await groupSet.save();

        // Auto-split logic
        if (groupStructure === 'byGroupCount') {
            const numGroups = parseInt(groupCount);
            if (!numGroups || numGroups < 1) {
                return res.status(400).json({ error: 'Invalid number of groups' });
            }
            const course = await Course.findById(courseId);
            if (!course) {
                return res.status(404).json({ error: 'Course not found' });
            }
            const students = [...course.students];
            for (let i = students.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [students[i], students[j]] = [students[j], students[i]];
            }
            let groups = [];
            const groupSize = Math.ceil(students.length / numGroups);
            for (let i = 0; i < students.length; i += groupSize) {
                const groupMembers = students.slice(i, i + groupSize);
                if (groupMembers.length === 0) continue;
                const groupName = `Group ${groups.length + 1}`;
                const groupId = `${groupName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const group = new Group({
                    name: groupName,
                    groupSet: groupSet._id,
                    members: groupMembers,
                    leader: groupMembers[0],
                    groupId,
                    course: course._id
                });
                await group.save();
                groups.push(group);
            }
            return res.status(201).json({ groupSet, groups });
        } else if (groupStructure === 'byStudentsPerGroup') {
            const size = parseInt(studentsPerGroup);
            if (!size || size < 1) {
                return res.status(400).json({ error: 'Invalid number of students per group' });
            }
            const course = await Course.findById(courseId);
            if (!course) {
                return res.status(404).json({ error: 'Course not found' });
            }
            const students = [...course.students];
            for (let i = students.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [students[i], students[j]] = [students[j], students[i]];
            }
            let groups = [];
            for (let i = 0; i < students.length; i += size) {
                const groupMembers = students.slice(i, i + size);
                if (groupMembers.length === 0) continue;
                const groupName = `Group ${groups.length + 1}`;
                const groupId = `${groupName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const group = new Group({
                    name: groupName,
                    groupSet: groupSet._id,
                    members: groupMembers,
                    leader: groupMembers[0],
                    groupId,
                    course: course._id
                });
                await group.save();
                groups.push(group);
            }
            return res.status(201).json({ groupSet, groups });
        } else {
            res.status(201).json(groupSet);
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/sets/:courseId', protect, async (req, res) => {
    try {
        const { courseId } = req.params;
        
        // Validate courseId
        if (!mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ error: 'Invalid course ID format' });
        }
        
        const groupSets = await GroupSet.find({ course: courseId });
        res.json(groupSets);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Group Routes
router.post('/sets/:setId/groups', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { name, members, leader, groupId } = req.body;
        const { setId } = req.params;
        
        // Validate setId
        if (!mongoose.Types.ObjectId.isValid(setId)) {
            return res.status(400).json({ error: 'Invalid group set ID format' });
        }
        
        // Validate name
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        // Find the group set and its course
        const groupSet = await GroupSet.findById(setId);
        if (!groupSet) {
            return res.status(404).json({ error: 'Group set not found' });
        }
        const course = await Course.findById(groupSet.course);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        // Only allow the instructor to create groups
        const userId = req.user._id || req.user.id;
        if (course.instructor.toString() !== userId.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to create groups for this course' });
        }
        
        // Validate members are enrolled in course
        if (members && Array.isArray(members)) {
            for (const memberId of members) {
                if (!mongoose.Types.ObjectId.isValid(memberId)) {
                    return res.status(400).json({ error: `Invalid member ID: ${memberId}` });
                }
                const isEnrolled = course.students.some(s => s.toString() === memberId.toString());
                if (!isEnrolled) {
                    return res.status(400).json({ error: `User ${memberId} is not enrolled in this course` });
                }
            }
        }
        const group = new Group({
            name,
            groupSet: req.params.setId,
            members,
            leader,
            groupId,
            course: course._id
        });
        await group.save();
        res.status(201).json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Auto-split students into groups
router.post('/sets/:setId/auto-split', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { groupSize, students } = req.body;
        const { setId } = req.params;
        
        // Validate setId
        if (!mongoose.Types.ObjectId.isValid(setId)) {
            return res.status(400).json({ error: 'Invalid group set ID format' });
        }
        
        // Validate groupSize
        const size = parseInt(groupSize);
        if (!size || size < 1) {
            return res.status(400).json({ error: 'Invalid group size' });
        }
        
        // Validate students array
        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ error: 'Students array is required and must not be empty' });
        }
        
        // Validate all student IDs
        for (const studentId of students) {
            if (!mongoose.Types.ObjectId.isValid(studentId)) {
                return res.status(400).json({ error: `Invalid student ID: ${studentId}` });
            }
        }
        
        // Verify groupSet exists
        const groupSet = await GroupSet.findById(setId);
        if (!groupSet) {
            return res.status(404).json({ error: 'Group set not found' });
        }
        
        // Get course to verify students are enrolled
        const course = await Course.findById(groupSet.course);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        // Verify user is instructor
        const userId = req.user._id || req.user.id;
        if (course.instructor.toString() !== userId.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        const groups = [];
        const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < shuffledStudents.length; i += size) {
            const groupMembers = shuffledStudents.slice(i, i + size);
            if (groupMembers.length === 0) continue;
            
            const group = new Group({
                name: `Group ${Math.floor(i / size) + 1}`,
                groupSet: setId,
                members: groupMembers,
                leader: groupMembers[0], // First member as leader
                course: course._id
            });
            await group.save();
            groups.push(group);
        }
        
        res.status(201).json(groups);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Self-signup for groups
router.post('/sets/:setId/self-signup', protect, async (req, res) => {
    try {
        const { groupId } = req.body;
        const { setId } = req.params;
        const userId = req.user._id || req.user.id;
        
        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(setId)) {
            return res.status(400).json({ error: 'Invalid group set ID format' });
        }
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID format' });
        }
        
        const groupSet = await GroupSet.findById(setId);
        if (!groupSet) {
            return res.status(404).json({ error: 'Group set not found' });
        }
        
        if (!groupSet.allowSelfSignup) {
            return res.status(403).json({ error: 'Self signup is not allowed for this group set' });
        }
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Verify group belongs to this groupSet
        if (group.groupSet.toString() !== setId) {
            return res.status(400).json({ error: 'Group does not belong to this group set' });
        }
        
        // Verify user is enrolled in course
        const course = await Course.findById(group.course);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        const isEnrolled = course.students.some(s => s.toString() === userId.toString());
        if (!isEnrolled) {
            return res.status(403).json({ error: 'You must be enrolled in the course to join a group' });
        }
        
        // Use proper ObjectId comparison
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const isAlreadyMember = group.members.some(m => m.toString() === userIdObj.toString());
        if (isAlreadyMember) {
            return res.status(400).json({ error: 'Already a member of this group' });
        }
        
        group.members.push(userIdObj);
        await group.save();
        
        res.json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all groups in a set
router.get('/sets/:setId/groups', protect, async (req, res) => {
    try {
        const { setId } = req.params;
        
        // Validate setId
        if (!mongoose.Types.ObjectId.isValid(setId)) {
            return res.status(400).json({ error: 'Invalid group set ID format' });
        }
        
        const groups = await Group.find({ groupSet: setId })
            .populate('members', 'firstName lastName email profilePicture')
            .populate('leader', 'firstName lastName email profilePicture');
        res.json(groups);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update group
router.put('/:groupId', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { name, members, leader } = req.body;
        const { groupId } = req.params;
        const userId = req.user._id || req.user.id;
        
        // Validate groupId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: 'Invalid group ID format' });
        }
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Verify user has access to the course
        const groupSet = await GroupSet.findById(group.groupSet);
        if (!groupSet) {
            return res.status(404).json({ message: 'Group set not found' });
        }
        
        const course = await Course.findById(groupSet.course);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if user is the instructor or admin of the course
        const isInstructor = course.instructor.toString() === userId.toString();
        const isAdmin = req.user.role === 'admin';
        const isCourseAdmin = course.admins && course.admins.some(a => a.toString() === userId.toString());
        
        if (!isInstructor && !isAdmin && !isCourseAdmin) {
            return res.status(403).json({ message: 'Not authorized to modify this group' });
        }
        
        // Validate members are enrolled in course if provided
        if (members && Array.isArray(members)) {
            for (const memberId of members) {
                if (!mongoose.Types.ObjectId.isValid(memberId)) {
                    return res.status(400).json({ message: `Invalid member ID: ${memberId}` });
                }
                const isEnrolled = course.students.some(s => s.toString() === memberId.toString());
                if (!isEnrolled) {
                    return res.status(400).json({ message: `User ${memberId} is not enrolled in this course` });
                }
            }
        }

        // Update the group
        const updatedGroup = await Group.findByIdAndUpdate(
            req.params.groupId,
            { name, members, leader },
            { new: true }
        ).populate('members', 'firstName lastName email')
         .populate('leader', 'firstName lastName email');

        res.json(updatedGroup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete group
router.delete('/groups/:groupId', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id || req.user.id;
        
        // Validate groupId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID format' });
        }
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Verify user has access to the course
        const groupSet = await GroupSet.findById(group.groupSet);
        if (!groupSet) {
            return res.status(404).json({ error: 'Group set not found' });
        }
        
        const course = await Course.findById(groupSet.course);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        // Check authorization
        const isInstructor = course.instructor.toString() === userId.toString();
        const isAdmin = req.user.role === 'admin';
        const isCourseAdmin = course.admins && course.admins.some(a => a.toString() === userId.toString());
        
        if (!isInstructor && !isAdmin && !isCourseAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this group' });
        }
        
        await Group.findByIdAndDelete(groupId);
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Send message to group
router.post('/:groupId/message', protect, async (req, res) => {
  try {
    const { subject, content } = req.body;
    const { groupId } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate groupId
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Subject is required' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    const group = await Group.findById(groupId).populate('members');
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify user has access to the course
    const groupSet = await GroupSet.findById(group.groupSet);
    if (!groupSet) {
      return res.status(404).json({ message: 'Group set not found' });
    }
    
    const course = await Course.findById(groupSet.course);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Check authorization (Course model uses 'instructor' singular, not 'instructors')
    const isInstructor = course.instructor.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    const isCourseAdmin = course.admins && course.admins.some(a => a.toString() === userId.toString());
    
    if (!isInstructor && !isAdmin && !isCourseAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create a thread for the group message
    const thread = new Thread({
      course: course._id,
      title: `[Group ${group.name}] ${subject}`,
      content,
      author: userId,
      isGroupMessage: true,
      group: group._id,
      recipients: group.members && Array.isArray(group.members) 
        ? group.members.map(m => m._id || m) 
        : []
    });

    await thread.save();
    res.json(thread);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get group activity
router.get('/:groupId/activity', protect, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate groupId
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID format' });
    }
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify user has access to the course
    const groupSet = await GroupSet.findById(group.groupSet);
    if (!groupSet) {
      return res.status(404).json({ message: 'Group set not found' });
    }
    
    const course = await Course.findById(groupSet.course);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Check authorization (Course model uses 'instructor' singular, not 'instructors')
    const isInstructor = course.instructor.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    const isCourseAdmin = course.admins && course.admins.some(a => a.toString() === userId.toString());
    const isGroupMember = group.members && group.members.some(m => m.toString() === userId.toString());
    
    if (!isInstructor && !isAdmin && !isCourseAdmin && !isGroupMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get group's submissions
    const submissions = await Submission.find({
      group: group._id
    }).populate('assignment').sort('-submittedAt');

    // Get group's discussions
    const discussions = await Thread.find({
      group: group._id
    }).populate('author').sort('-createdAt');

    res.json({
      submissions,
      discussions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single group by ID
router.get('/:groupId', protect, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Validate groupId
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID format' });
    }
    
    const group = await Group.findById(groupId).populate({ path: 'groupSet', select: 'name course' });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.groupSet) {
      return res.status(404).json({ error: 'Group set not found' });
    }
    
    res.json({ 
      _id: group._id, 
      name: group.name, 
      groupSet: group.groupSet._id, 
      groupSetName: group.groupSet.name, 
      course: group.groupSet.course 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single group set by ID
router.get('/sets/id/:setId', protect, async (req, res) => {
  try {
    const { setId } = req.params;
    
    // Validate setId
    if (!mongoose.Types.ObjectId.isValid(setId)) {
      return res.status(400).json({ error: 'Invalid group set ID format' });
    }
    
    const groupSet = await GroupSet.findById(setId).populate('course', '_id title');
    if (!groupSet) {
      return res.status(404).json({ error: 'Group set not found' });
    }
    res.json(groupSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all members of a group
router.get('/:groupId/members', groupController.getGroupMembers);

// Remove a member from a group
router.delete('/:groupId/members/:userId', groupController.removeGroupMember);

// Get available students for a group set (not in any group in the set)
router.get('/sets/:groupSetId/available-students', groupController.getAvailableStudentsForGroupSet);

// Add a member to a group
router.post('/:groupId/members', groupController.addGroupMember);

module.exports = router; 