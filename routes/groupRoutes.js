const express = require('express');
const router = express.Router();
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
        const groupSets = await GroupSet.find({ course: req.params.courseId });
        res.json(groupSets);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Group Routes
router.post('/sets/:setId/groups', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { name, members, leader, groupId } = req.body;
        // Find the group set and its course
        const groupSet = await GroupSet.findById(req.params.setId);
        if (!groupSet) {
            return res.status(404).json({ error: 'Group set not found' });
        }
        const course = await Course.findById(groupSet.course);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        // Only allow the instructor to create groups
        if (course.instructor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to create groups for this course' });
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
        const groups = [];
        const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < shuffledStudents.length; i += groupSize) {
            const groupMembers = shuffledStudents.slice(i, i + groupSize);
            const group = new Group({
                name: `Group ${Math.floor(i / groupSize) + 1}`,
                groupSet: req.params.setId,
                members: groupMembers,
                leader: groupMembers[0] // First member as leader
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
        const groupSet = await GroupSet.findById(req.params.setId);
        
        if (!groupSet.allowSelfSignup) {
            return res.status(403).json({ error: 'Self signup is not allowed for this group set' });
        }
        
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        if (group.members.includes(req.user._id)) {
            return res.status(400).json({ error: 'Already a member of this group' });
        }
        
        group.members.push(req.user._id);
        await group.save();
        
        res.json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all groups in a set
router.get('/sets/:setId/groups', protect, async (req, res) => {
    try {
        const groups = await Group.find({ groupSet: req.params.setId })
            .populate('members', 'firstName lastName email')
            .populate('leader', 'firstName lastName email');
        res.json(groups);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update group
router.put('/:groupId', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { name, members, leader } = req.body;
        const group = await Group.findById(req.params.groupId);
        
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
        if (course.instructor.toString() !== req.user._id.toString() && 
            (!course.admins || !course.admins.includes(req.user._id))) {
            return res.status(403).json({ message: 'Not authorized to modify this group' });
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
        await Group.findByIdAndDelete(req.params.groupId);
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Send message to group
router.post('/:groupId/message', protect, async (req, res) => {
  try {
    const { subject, content } = req.body;
    const group = await Group.findById(req.params.groupId).populate('members');
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify user has access to the course
    const groupSet = await GroupSet.findById(group.groupSet);
    const course = await Course.findById(groupSet.course);
    if (!course.instructors.includes(req.user._id) && !course.admins.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create a thread for the group message
    const thread = new Thread({
      course: course._id,
      title: `[Group ${group.name}] ${subject}`,
      content,
      author: req.user._id,
      isGroupMessage: true,
      group: group._id,
      recipients: group.members.map(m => m._id)
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
    const group = await Group.findById(req.params.groupId);
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Verify user has access to the course
    const groupSet = await GroupSet.findById(group.groupSet);
    const course = await Course.findById(groupSet.course);
    if (!course.instructors.includes(req.user._id) && !course.admins.includes(req.user._id)) {
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
    const group = await Group.findById(req.params.groupId).populate({ path: 'groupSet', select: 'name course' });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ _id: group._id, name: group.name, groupSet: group.groupSet._id, groupSetName: group.groupSet.name, course: group.groupSet.course });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single group set by ID
router.get('/sets/id/:setId', protect, async (req, res) => {
  try {
    const groupSet = await GroupSet.findById(req.params.setId).populate('course', '_id title');
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