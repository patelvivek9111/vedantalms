const mongoose = require('mongoose');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, sendErrorResponse, asyncHandler } = require('../utils/errorHandler');

// @desc    Search users by email or name
// @route   GET /api/users/search
// @access  Private (Teacher/Admin)
exports.searchUsers = async (req, res) => {
  try {
    const { email, name, role, courseId } = req.query;
    

    // If no search parameters provided, return error
    if (!email && !name && !role) {
      return sendErrorResponse(res, new ValidationError('At least one of email, name, or role query parameter is required'), { action: 'searchUsers' });
    }

    // Build $or conditions for name and email search
    const orConditions = [];
    
    // Sanitize search input to prevent ReDoS
    const sanitizeRegex = (input) => {
      if (!input || typeof input !== 'string') return '';
      // Limit length and escape special regex characters
      return input.trim().substring(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    
    // If both name and email are provided with the same value, treat it as a general search
    if (email && name && email === name) {
      const searchTerm = sanitizeRegex(email); // or name, they're the same
      if (searchTerm) {
        orConditions.push(
          { email: { $regex: searchTerm, $options: 'i' } },
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } }
        );
      }
    } else {
      // Handle individual parameters
      if (email) {
        const sanitizedEmail = sanitizeRegex(email);
        if (sanitizedEmail) {
          orConditions.push({ email: { $regex: sanitizedEmail, $options: 'i' } });
        }
      }
      if (name) {
        const sanitizedName = sanitizeRegex(name);
        if (sanitizedName) {
          orConditions.push({ firstName: { $regex: sanitizedName, $options: 'i' } });
          orConditions.push({ lastName: { $regex: sanitizedName, $options: 'i' } });
        }
      }
    }

    const searchQuery = {};
    
    // Add role filter if specified
    if (role) {
      const validRoles = ['student', 'teacher', 'admin'];
      const roleArray = role.split(',').map(r => r.trim()).filter(r => validRoles.includes(r));
      if (roleArray.length > 0) {
        searchQuery.role = { $in: roleArray };
      }
    }
    
    // Add search conditions
    if (orConditions.length > 0) {
      searchQuery.$or = orConditions;
    }
    
    // Add course filter if specified
    if (courseId) {
      // Validate courseId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid course ID format'
        });
      }
      searchQuery.courses = courseId;
    }


    // Search for users with matching criteria
    const users = await User.find(searchQuery).select('firstName lastName email role profilePicture');
    

    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    logger.logError(err, { action: 'searchUsers', query: req.query });
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
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const { firstName, lastName, bio, profilePicture } = req.body;
    
    // Validate firstName and lastName if provided
    if (firstName !== undefined && (!firstName || !firstName.trim())) {
      return res.status(400).json({
        success: false,
        message: 'First name cannot be empty'
      });
    }
    
    if (lastName !== undefined && (!lastName || !lastName.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Last name cannot be empty'
      });
    }
    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName.trim();
    if (lastName !== undefined) updateFields.lastName = lastName.trim();
    if (bio !== undefined) updateFields.bio = bio ? bio.trim() : bio;
    if (profilePicture !== undefined) updateFields.profilePicture = profilePicture;
    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    logger.logError(err, { action: 'updateProfile', userId: req.user?._id });
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
    
    const { uploadToCloudinary, isCloudinaryConfigured, deleteFromCloudinary, extractPublicId } = require('../utils/cloudinary');
    
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    let profilePictureUrl;
    
    // Get current user to delete old profile picture if exists
    const currentUser = await User.findById(userId);
    
    // Use Cloudinary if configured, otherwise use local storage
    if (isCloudinaryConfigured()) {
      try {
        const result = await uploadToCloudinary(req.file, {
          folder: 'lms/profile-pictures',
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' } // Optimize for profile pictures
          ]
        });
        profilePictureUrl = result.url;
        
        // Delete old profile picture from Cloudinary if it exists
        if (currentUser.profilePicture && currentUser.profilePicture.includes('cloudinary.com')) {
          const oldPublicId = extractPublicId(currentUser.profilePicture);
          if (oldPublicId) {
            try {
              await deleteFromCloudinary(oldPublicId, 'image');
            } catch (deleteErr) {
              logger.warn('Error deleting old profile picture from Cloudinary', { error: deleteErr.message, userId: req.user?._id });
            }
          }
        }
      } catch (cloudinaryError) {
        logger.warn('Cloudinary upload failed, falling back to local storage', { error: cloudinaryError.message, userId: req.user?._id });
        profilePictureUrl = `/uploads/${req.file.filename}`;
      }
    } else {
      profilePictureUrl = `/uploads/${req.file.filename}`;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: profilePictureUrl },
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    logger.logError(err, { action: 'uploadProfilePicture', userId: req.user?._id });
    res.status(500).json({ success: false, message: 'Server error while uploading profile picture', error: err.message });
  }
};

// @desc    Get current user's preferences
// @route   GET /api/users/me/preferences
// @access  Private
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
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
    
    // Ensure courseQuickLinks is properly formatted
    if (!preferences.courseQuickLinks) {
      preferences.courseQuickLinks = {};
    }
    
    // If it's a Map, convert to object
    if (preferences.courseQuickLinks instanceof Map) {
      preferences.courseQuickLinks = Object.fromEntries(preferences.courseQuickLinks);
    }
    
    // Ensure all values are arrays (convert old single values if needed)
    const quickLinks = {};
    Object.keys(preferences.courseQuickLinks).forEach(courseId => {
      const value = preferences.courseQuickLinks[courseId];
      if (Array.isArray(value)) {
        quickLinks[courseId] = value;
      } else if (value) {
        // Old format: single value, convert to array
        quickLinks[courseId] = [value];
      } else {
        // Empty or null, set as empty array
        quickLinks[courseId] = [];
      }
    });
    preferences.courseQuickLinks = quickLinks;
    
    res.json({ success: true, preferences });
  } catch (err) {
    logger.logError(err, { action: 'getPreferences', userId: req.user?._id });
    res.status(500).json({ success: false, message: 'Server error while getting preferences', error: err.message });
  }
};

// @desc    Update current user's preferences
// @route   PUT /api/users/me/preferences
// @access  Private
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const { language, timeZone, theme, showOnlineStatus, courseColors, courseQuickLinks } = req.body;
    const updateFields = {};
    if (language !== undefined) updateFields['preferences.language'] = language;
    if (timeZone !== undefined) updateFields['preferences.timeZone'] = timeZone;
    if (theme !== undefined) updateFields['preferences.theme'] = theme;
    if (showOnlineStatus !== undefined) updateFields['preferences.showOnlineStatus'] = showOnlineStatus;
    
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
    
    // Handle courseQuickLinks - update specific course quick link(s)
    if (courseQuickLinks !== undefined) {
      const user = await User.findById(userId).select('preferences');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // Get current courseQuickLinks, handling both Map and object formats
      let currentQuickLinks = {};
      if (user.preferences && user.preferences.courseQuickLinks) {
        if (user.preferences.courseQuickLinks instanceof Map) {
          currentQuickLinks = Object.fromEntries(user.preferences.courseQuickLinks);
        } else {
          currentQuickLinks = user.preferences.courseQuickLinks || {};
        }
      }
      
      // Merge new quick links with existing ones
      const mergedQuickLinks = { ...currentQuickLinks };
      Object.keys(courseQuickLinks).forEach(courseId => {
        const value = courseQuickLinks[courseId];
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          // Keep empty arrays in preferences (don't delete) so we know the user has interacted with this
          mergedQuickLinks[courseId] = [];
        } else {
          mergedQuickLinks[courseId] = value;
        }
      });
      updateFields['preferences.courseQuickLinks'] = mergedQuickLinks;
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
    
    // Ensure courseQuickLinks is properly formatted
    if (!preferences.courseQuickLinks) {
      preferences.courseQuickLinks = {};
    }
    
    // If it's a Map, convert to object
    if (preferences.courseQuickLinks instanceof Map) {
      preferences.courseQuickLinks = Object.fromEntries(preferences.courseQuickLinks);
    }
    
    // Ensure all courseQuickLinks values are arrays (convert old single values if needed)
    const quickLinks = {};
    Object.keys(preferences.courseQuickLinks).forEach(courseId => {
      const value = preferences.courseQuickLinks[courseId];
      if (Array.isArray(value)) {
        quickLinks[courseId] = value;
      } else if (value && !Array.isArray(value)) {
        // Old format: single value, convert to array
        quickLinks[courseId] = [value];
      } else {
        // Empty or null, set as empty array
        quickLinks[courseId] = [];
      }
    });
    preferences.courseQuickLinks = quickLinks;
    
    res.json({ success: true, preferences });
  } catch (err) {
    logger.logError(err, { action: 'updatePreferences', userId: req.user?._id });
    res.status(500).json({ success: false, message: 'Server error while updating preferences', error: err.message });
  }
};

// @desc    Update current user's password
// @route   PUT /api/users/me/password
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  // Validate all fields are provided
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ValidationError('All password fields are required');
  }
  
  // Validate new password matches confirm password
  if (newPassword !== confirmPassword) {
    throw new ValidationError('New password and confirm password do not match');
  }
  
  // Validate new password length (minimum 6 characters as per schema)
  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters long');
  }
  
  // Validate new password is different from current password
  if (currentPassword === newPassword) {
    throw new ValidationError('New password must be different from current password');
  }
  
  // Get user with password field selected
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Verify current password
  const isPasswordMatch = await user.matchPassword(currentPassword);
  if (!isPasswordMatch) {
    throw new ValidationError('Current password is incorrect');
  }
  
  // Update password (will be hashed by pre-save hook)
  user.password = newPassword;
  await user.save();
  
  res.json({ 
    success: true, 
    message: 'Password updated successfully' 
  });
}); 