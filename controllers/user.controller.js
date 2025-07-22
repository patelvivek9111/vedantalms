const User = require('../models/user.model');

// @desc    Search users by email or name
// @route   GET /api/users/search
// @access  Private (Teacher/Admin)
exports.searchUsers = async (req, res) => {
  try {
    const { email, name, role, courseId } = req.query;
  

    // If no email/name but role is provided, allow fetching all users of that role
    if (!email && !name && !role) {
      return res.status(400).json({
        success: false,
        message: 'At least one of email, name, or role query parameter is required'
      });
    }

    // Build $or conditions for name and email
    const orConditions = [];
    if (email) {
      orConditions.push({ email: { $regex: email, $options: 'i' } });
    }
    if (name) {
      orConditions.push({ firstName: { $regex: name, $options: 'i' } });
      orConditions.push({ lastName: { $regex: name, $options: 'i' } });
    }

    const searchQuery = {};
    if (role) {
      searchQuery.role = { $in: role.split(',') };
    }
    if (orConditions.length > 0) {
      searchQuery.$or = orConditions;
    }
    if (courseId) {
      searchQuery.courses = courseId; // assumes user model has a 'courses' array
    }

    

    // Search for users with matching criteria
    const users = await User.find(searchQuery).select('firstName lastName email role');
    

    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while searching users',
      error: err.message
    });
  }
};

// @desc    Update current user's profile
// @route   PUT /api/users/me
// @access  Private
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { firstName, lastName, bio, profilePicture } = req.body;
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (bio !== undefined) updateFields.bio = bio;
    if (profilePicture !== undefined) updateFields.profilePicture = profilePicture;
    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error while updating profile', error: err.message });
  }
};

// @desc    Upload and update profile picture
// @route   POST /api/users/me/profile-picture
// @access  Private
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const userId = req.user._id;
    const profilePictureUrl = `/uploads/${req.file.filename}`;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: profilePictureUrl },
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ success: false, message: 'Server error while uploading profile picture', error: err.message });
  }
};

// @desc    Get current user's preferences
// @route   GET /api/users/me/preferences
// @access  Private
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('preferences');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, preferences: user.preferences });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ success: false, message: 'Server error while getting preferences', error: err.message });
  }
};

// @desc    Update current user's preferences
// @route   PUT /api/users/me/preferences
// @access  Private
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { language, timeZone, theme } = req.body;
    const updateFields = {};
    if (language !== undefined) updateFields['preferences.language'] = language;
    if (timeZone !== undefined) updateFields['preferences.timeZone'] = timeZone;
    if (theme !== undefined) updateFields['preferences.theme'] = theme;
    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true }).select('preferences');
    res.json({ success: true, preferences: updatedUser.preferences });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ success: false, message: 'Server error while updating preferences', error: err.message });
  }
}; 