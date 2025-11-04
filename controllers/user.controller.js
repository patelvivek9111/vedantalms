const User = require('../models/user.model');

// @desc    Search users by email or name
// @route   GET /api/users/search
// @access  Private (Teacher/Admin)
exports.searchUsers = async (req, res) => {
  try {
    const { email, name, role, courseId } = req.query;
    

    // If no search parameters provided, return error
    if (!email && !name && !role) {
      return res.status(400).json({
        success: false,
        message: 'At least one of email, name, or role query parameter is required'
      });
    }

    // Build $or conditions for name and email search
    const orConditions = [];
    
    // If both name and email are provided with the same value, treat it as a general search
    if (email && name && email === name) {
      const searchTerm = email; // or name, they're the same
      orConditions.push(
        { email: { $regex: searchTerm, $options: 'i' } },
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } }
      );
    } else {
      // Handle individual parameters
      if (email) {
        orConditions.push({ email: { $regex: email, $options: 'i' } });
      }
      if (name) {
        orConditions.push({ firstName: { $regex: name, $options: 'i' } });
        orConditions.push({ lastName: { $regex: name, $options: 'i' } });
      }
    }

    const searchQuery = {};
    
    // Add role filter if specified
    if (role) {
      searchQuery.role = { $in: role.split(',') };
    }
    
    // Add search conditions
    if (orConditions.length > 0) {
      searchQuery.$or = orConditions;
    }
    
    // Add course filter if specified
    if (courseId) {
      searchQuery.courses = courseId;
    }


    // Search for users with matching criteria
    const users = await User.find(searchQuery).select('firstName lastName email role profilePicture');
    

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
    
    // Ensure preferences object exists and courseColors is properly formatted
    const preferences = user.preferences || {};
    if (!preferences.courseColors) {
      preferences.courseColors = {};
    }
    
    // If it's a Map, convert to object
    if (preferences.courseColors instanceof Map) {
      preferences.courseColors = Object.fromEntries(preferences.courseColors);
    }
    
    res.json({ success: true, preferences });
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
    const { language, timeZone, theme, courseColors } = req.body;
    const updateFields = {};
    if (language !== undefined) updateFields['preferences.language'] = language;
    if (timeZone !== undefined) updateFields['preferences.timeZone'] = timeZone;
    if (theme !== undefined) updateFields['preferences.theme'] = theme;
    
    // Handle courseColors - update specific course color(s)
    if (courseColors !== undefined) {
      const user = await User.findById(userId).select('preferences');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Get current courseColors, handling both Map and object formats
      let currentColors = {};
      if (user.preferences && user.preferences.courseColors) {
        if (user.preferences.courseColors instanceof Map) {
          currentColors = Object.fromEntries(user.preferences.courseColors);
        } else {
          currentColors = user.preferences.courseColors || {};
        }
      }
      
      // Merge new colors with existing ones
      const mergedColors = { ...currentColors, ...courseColors };
      updateFields['preferences.courseColors'] = mergedColors;
    }
    
    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true }).select('preferences');
    
    // Ensure preferences object exists and courseColors is properly formatted
    const preferences = updatedUser.preferences || {};
    if (!preferences.courseColors) {
      preferences.courseColors = {};
    }
    
    // If it's a Map, convert to object
    if (preferences.courseColors instanceof Map) {
      preferences.courseColors = Object.fromEntries(preferences.courseColors);
    }
    
    res.json({ success: true, preferences });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ success: false, message: 'Server error while updating preferences', error: err.message });
  }
}; 