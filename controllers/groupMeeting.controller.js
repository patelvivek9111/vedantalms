const mongoose = require('mongoose');
const Group = require('../models/Group');
const Course = require('../models/course.model');
const GroupMeeting = require('../models/groupMeeting.model');
const { createNotification } = require('../routes/notification.routes');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const canManageGroup = async (group, user) => {
  if (!group || !user) return false;
  if (user.role === 'admin') return true;
  const course = await Course.findById(group.course).select('instructor admins');
  if (!course) return false;
  if (course.instructor && course.instructor.toString() === user._id.toString()) return true;
  return Array.isArray(course.admins) && course.admins.some((id) => id.toString() === user._id.toString());
};

const isGroupMember = (group, userId) =>
  Array.isArray(group.members) && group.members.some((id) => id.toString() === userId.toString());

const canAccessCourse = (course, user) => {
  if (!course || !user) return false;
  if (user.role === 'admin') return true;
  if (course.instructor && course.instructor.toString() === user._id.toString()) return true;
  if (Array.isArray(course.admins) && course.admins.some((id) => id.toString() === user._id.toString())) return true;
  return Array.isArray(course.students) && course.students.some((id) => id.toString() === user._id.toString());
};

exports.listCourseMeetings = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId).select('instructor admins students');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!canAccessCourse(course, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view meetings' });
    }

    const meetings = await GroupMeeting.find({ course: courseId })
      .sort({ startTime: 1 })
      .populate('group', 'name')
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      data: meetings,
      canManage: req.user.role === 'teacher' || req.user.role === 'admin',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCourseMeeting = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }
    const course = await Course.findById(courseId).select('instructor admins');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!(req.user.role === 'teacher' || req.user.role === 'admin') || !canAccessCourse(course, req.user)) {
      return res.status(403).json({ success: false, message: 'Only teachers/admins can create meetings' });
    }

    const { title, description, startTime, durationMinutes, joinUrl, recordingUrl } = req.body;
    if (!title || !startTime || !durationMinutes || !joinUrl) {
      return res.status(400).json({ success: false, message: 'title, startTime, durationMinutes, and joinUrl are required' });
    }

    const parsedStart = new Date(startTime);
    if (Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startTime' });
    }

    const meeting = await GroupMeeting.create({
      group: null,
      course: courseId,
      createdBy: req.user._id,
      title,
      description: description || '',
      startTime: parsedStart,
      durationMinutes,
      joinUrl,
      recordingUrl: recordingUrl || '',
      provider: 'zoho_meeting',
    });

    const creatorName = `${req.user.firstName} ${req.user.lastName}`;
    const recipients = Array.isArray(course.students) ? course.students : [];
    await Promise.all(
      recipients
        .filter((memberId) => memberId.toString() !== req.user._id.toString())
        .map((memberId) =>
          createNotification(memberId, {
            type: 'announcement',
            title: 'New Course Meeting',
            message: `${creatorName} scheduled "${meeting.title}" for ${meeting.startTime.toLocaleString()}.`,
            link: `/courses/${courseId}/meetings`,
            relatedId: meeting._id,
            relatedType: 'course',
            priority: 'high',
          })
        )
    );

    const populated = await GroupMeeting.findById(meeting._id).populate('group', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCourseMeeting = async (req, res) => {
  try {
    const { courseId, meetingId } = req.params;
    if (!isValidObjectId(courseId) || !isValidObjectId(meetingId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const course = await Course.findById(courseId).select('instructor admins students');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!canAccessCourse(course, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (!(req.user.role === 'teacher' || req.user.role === 'admin')) {
      return res.status(403).json({ success: false, message: 'Only teachers/admins can update meetings' });
    }

    const meeting = await GroupMeeting.findOne({ _id: meetingId, course: courseId });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

    const allowed = ['title', 'description', 'startTime', 'durationMinutes', 'joinUrl', 'recordingUrl', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        meeting[key] = req.body[key];
      }
    }
    if (meeting.status === 'cancelled' && !meeting.cancelledAt) {
      meeting.cancelledAt = new Date();
    }
    if (meeting.status !== 'cancelled') {
      meeting.cancelledAt = null;
    }
    await meeting.save();

    res.json({ success: true, data: meeting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listGroupMeetings = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId).select('members course');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const manager = await canManageGroup(group, req.user);
    const member = isGroupMember(group, req.user._id);
    if (!manager && !member) {
      return res.status(403).json({ success: false, message: 'Not authorized to view meetings' });
    }

    const meetings = await GroupMeeting.find({ group: groupId })
      .sort({ startTime: 1 })
      .populate('createdBy', 'firstName lastName');

    res.json({ success: true, data: meetings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGroupMeeting = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId).select('members course name');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const manager = await canManageGroup(group, req.user);
    if (!manager) {
      return res.status(403).json({ success: false, message: 'Only teachers/admins can create meetings' });
    }

    const { title, description, startTime, durationMinutes, joinUrl, recordingUrl } = req.body;
    if (!title || !startTime || !durationMinutes || !joinUrl) {
      return res.status(400).json({ success: false, message: 'title, startTime, durationMinutes, and joinUrl are required' });
    }

    let parsedStart = new Date(startTime);
    if (Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startTime' });
    }

    const meeting = await GroupMeeting.create({
      group: group._id,
      course: group.course,
      createdBy: req.user._id,
      title,
      description: description || '',
      startTime: parsedStart,
      durationMinutes,
      joinUrl,
      recordingUrl: recordingUrl || '',
      provider: 'zoho_meeting',
    });

    const creatorName = `${req.user.firstName} ${req.user.lastName}`;
    const notifyMembers = group.members.filter((memberId) => memberId.toString() !== req.user._id.toString());
    await Promise.all(
      notifyMembers.map((memberId) =>
        createNotification(memberId, {
          type: 'announcement',
          title: 'New Group Meeting',
          message: `${creatorName} scheduled "${meeting.title}" for ${meeting.startTime.toLocaleString()}.`,
          link: `/groups/${group._id}/meetings`,
          relatedId: meeting._id,
          relatedType: 'course',
          priority: 'high',
        })
      )
    );

    res.status(201).json({ success: true, data: meeting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGroupMeeting = async (req, res) => {
  try {
    const { groupId, meetingId } = req.params;
    if (!isValidObjectId(groupId) || !isValidObjectId(meetingId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const group = await Group.findById(groupId).select('members course');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const manager = await canManageGroup(group, req.user);
    if (!manager) return res.status(403).json({ success: false, message: 'Not authorized' });

    const meeting = await GroupMeeting.findOne({ _id: meetingId, group: groupId });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

    const allowed = ['title', 'description', 'startTime', 'durationMinutes', 'joinUrl', 'recordingUrl', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        meeting[key] = req.body[key];
      }
    }
    if (meeting.status === 'cancelled' && !meeting.cancelledAt) {
      meeting.cancelledAt = new Date();
    }
    if (meeting.status !== 'cancelled') {
      meeting.cancelledAt = null;
    }
    await meeting.save();

    const actorName = `${req.user.firstName} ${req.user.lastName}`;
    const isCancelled = meeting.status === 'cancelled';
    await Promise.all(
      group.members
        .filter((memberId) => memberId.toString() !== req.user._id.toString())
        .map((memberId) =>
          createNotification(memberId, {
            type: 'announcement',
            title: isCancelled ? 'Group Meeting Cancelled' : 'Group Meeting Updated',
            message: isCancelled
              ? `${actorName} cancelled "${meeting.title}".`
              : `${actorName} updated "${meeting.title}" (${new Date(meeting.startTime).toLocaleString()}).`,
            link: `/groups/${group._id}/meetings`,
            relatedId: meeting._id,
            relatedType: 'course',
            priority: isCancelled ? 'high' : 'medium',
          })
        )
    );

    res.json({ success: true, data: meeting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteGroupMeeting = async (req, res) => {
  try {
    const { groupId, meetingId } = req.params;
    if (!isValidObjectId(groupId) || !isValidObjectId(meetingId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const group = await Group.findById(groupId).select('course');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const manager = await canManageGroup(group, req.user);
    if (!manager) return res.status(403).json({ success: false, message: 'Not authorized' });

    const deleted = await GroupMeeting.findOneAndDelete({ _id: meetingId, group: groupId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, message: 'Meeting deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
