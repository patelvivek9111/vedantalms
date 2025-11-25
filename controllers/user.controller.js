const mongoose = require('mongoose');
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
              console.error('Error deleting old profile picture from Cloudinary:', deleteErr);
            }
          }
        }
      } catch (cloudinaryError) {
        console.error('Cloudinary upload failed, falling back to local storage:', cloudinaryError);
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
    console.error('Profile picture upload error:', err);
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
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
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