const User = require('../models/user.model');
const Course = require('../models/course.model');
const Assignment = require('../models/Assignment');
const Thread = require('../models/thread.model');
const Submission = require('../models/Submission');
const Module = require('../models/module.model');
const LoginActivity = require('../models/loginActivity.model');
const SystemSettings = require('../models/systemSettings.model');
const fs = require('fs');
const path = require('path');

// Get system statistics
exports.getSystemStats = async (req, res) => {
  try {
    // Count total users by role
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // Count active users (logged in within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // If user model has lastLogin field, use it. Otherwise, use createdAt as approximation
    const activeUsers = await User.countDocuments({
      $or: [
        { lastLogin: { $gte: sevenDaysAgo } },
        { createdAt: { $gte: sevenDaysAgo } }
      ]
    });

    // Count courses
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ published: true });
    
    // Count assignments
    const totalAssignments = await Assignment.countDocuments();
    
    // Count threads/discussions
    const totalThreads = await Thread.countDocuments();
    
    // Count submissions
    const totalSubmissions = await Submission.countDocuments();

    // Calculate storage (approximate based on uploaded files)
    // This is a simplified calculation - in production, you'd want to track actual file sizes
    const uploadsDir = path.join(__dirname, '../uploads');
    let storageUsed = 0;
    
    // Helper function to recursively calculate directory size
    const calculateDirSize = (dirPath) => {
      try {
        if (!fs.existsSync(dirPath)) {
          return 0;
        }
        
        let totalSize = 0;
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item.name);
          try {
            if (item.isDirectory()) {
              totalSize += calculateDirSize(itemPath);
            } else if (item.isFile()) {
              const stats = fs.statSync(itemPath);
              totalSize += stats.size;
            }
          } catch (err) {
            // Skip files/directories that can't be accessed
            continue;
          }
        }
        
        return totalSize;
      } catch (err) {
        console.error(`Error calculating size for ${dirPath}:`, err);
        return 0;
      }
    };
    
    try {
      storageUsed = calculateDirSize(uploadsDir);
    } catch (err) {
      console.error('Error calculating storage:', err);
      // Default to 0 if calculation fails
    }

    // Convert bytes to GB
    const storageUsedGB = parseFloat((storageUsed / (1024 * 1024 * 1024)).toFixed(2));
    const storageTotalGB = 1000; // Default 1TB

    // Determine system health based on various factors
    let systemHealth = 'good';
    // Prevent division by zero
    const storagePercentage = storageTotalGB > 0 ? (storageUsedGB / storageTotalGB) * 100 : 0;
    
    if (storagePercentage > 90) {
      systemHealth = 'critical';
    } else if (storagePercentage > 75) {
      systemHealth = 'warning';
    } else if (storagePercentage < 50) {
      systemHealth = 'excellent';
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalAdmins,
        activeUsers,
        totalCourses,
        publishedCourses,
        totalAssignments,
        totalThreads,
        totalSubmissions,
        systemHealth,
        storageUsed: storageUsedGB,
        storageTotal: storageTotalGB
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system statistics',
      error: error.message
    });
  }
};

// Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 10;
    // Validate limit is a positive integer
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 100) {
      limit = 100; // Cap at 100 for performance
    }
    const activities = [];

    // Get recent user registrations
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName role createdAt');

    recentUsers.forEach(user => {
      activities.push({
        id: user._id.toString(),
        type: 'user_registration',
        description: `New ${user.role} registered: ${user.firstName} ${user.lastName}`,
        timestamp: user.createdAt,
        severity: 'low'
      });
    });

    // Get recent course creations
    const recentCourses = await Course.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('instructor', 'firstName lastName')
      .select('title instructor createdAt');

    recentCourses.forEach(course => {
      const instructorName = course.instructor 
        ? `${course.instructor.firstName} ${course.instructor.lastName}`
        : 'Unknown';
      activities.push({
        id: course._id.toString(),
        type: 'course_creation',
        description: `New course created: ${course.title} by ${instructorName}`,
        timestamp: course.createdAt,
        severity: 'medium'
      });
    });

    // Get recent assignment submissions
    const recentSubmissions = await Submission.find()
      .sort({ submittedAt: -1 })
      .limit(5)
      .populate('student', 'firstName lastName')
      .populate('assignment', 'title')
      .select('student assignment submittedAt');

    recentSubmissions.forEach(submission => {
      if (submission.student && submission.assignment) {
        activities.push({
          id: submission._id.toString(),
          type: 'assignment_submission',
          description: `${submission.student.firstName} ${submission.student.lastName} submitted: ${submission.assignment.title}`,
          timestamp: submission.submittedAt || submission.createdAt,
          severity: 'low'
        });
      }
    });

    // Sort all activities by timestamp (newest first) and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    // Format timestamps to relative time
    const formatRelativeTime = (date) => {
      const now = new Date();
      const diffMs = now - new Date(date);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      return new Date(date).toLocaleDateString();
    };

    const formattedActivities = limitedActivities.map(activity => ({
      ...activity,
      timestamp: formatRelativeTime(activity.timestamp),
      timestampRaw: activity.timestamp
    }));

    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message
    });
  }
};

// Get analytics data
exports.getAnalytics = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    // Validate timeRange
    const validTimeRanges = ['7d', '30d', '90d', '1y'];
    const validatedTimeRange = validTimeRanges.includes(timeRange) ? timeRange : '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (validatedTimeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // User growth by month
    const userGrowth = [];
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
      
      const count = await User.countDocuments({
        createdAt: { $gte: monthDate, $lt: nextMonth }
      });
      
      userGrowth.push({ month: monthName, users: count });
    }

    // Course engagement
    const courses = await Course.find({ published: true })
      .populate('instructor', 'firstName lastName')
      .select('title students')
      .limit(10);
    
    const courseEngagement = await Promise.all(courses.map(async (course) => {
      // Get modules for this course
      const modules = await Module.find({ course: course._id }).select('_id');
      const moduleIds = modules.map(m => m._id);
      
      const assignmentCount = await Assignment.countDocuments({
        module: { $in: moduleIds }
      });
      
      return {
        course: course.title,
        students: course.students?.length || 0,
        assignments: assignmentCount
      };
    }));

    // System usage (daily active users for last 7 days)
    const systemUsage = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const activeUsers = await User.countDocuments({
        $or: [
          { lastLogin: { $gte: date, $lt: nextDate } },
          { createdAt: { $gte: date, $lt: nextDate } }
        ]
      });
      
      systemUsage.push({
        date: date.toISOString().split('T')[0],
        activeUsers: activeUsers
      });
    }

    // Top courses by enrollment
    const topCourses = await Course.find({ published: true })
      .select('title students')
      .sort({ students: -1 })
      .limit(10)
      .lean();
    
    const topCoursesData = topCourses.map(course => ({
      name: course.title,
      enrollment: course.students?.length || 0,
      completion: 0 // This would require more complex logic to calculate
    }));

    // Recent activity - simplified version
    const recentActivity = [];
    
    const recentUser = await User.findOne()
      .sort({ createdAt: -1 })
      .select('firstName lastName role createdAt');
    if (recentUser) {
      recentActivity.push({
        type: 'user_registration',
        description: `New ${recentUser.role} registered`,
        timestamp: 'recent'
      });
    }
    
    const recentCourse = await Course.findOne()
      .sort({ createdAt: -1 })
      .populate('instructor', 'firstName lastName')
      .select('title instructor createdAt');
    if (recentCourse) {
      recentActivity.push({
        type: 'course_creation',
        description: `New course created: ${recentCourse.title}`,
        timestamp: 'recent'
      });
    }
    
    const recentSubmission = await Submission.findOne()
      .sort({ submittedAt: -1 })
      .populate('assignment', 'title')
      .select('assignment submittedAt');
    if (recentSubmission && recentSubmission.assignment) {
      recentActivity.push({
        type: 'assignment_submission',
        description: `High submission rate detected`,
        timestamp: 'recent'
      });
    }

    res.json({
      success: true,
      data: {
        userGrowth,
        courseEngagement,
        systemUsage,
        topCourses: topCoursesData,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: error.message
    });
  }
};

// Get all users for admin management
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    
    const query = {};
    
    // Validate role
    const validRoles = ['student', 'teacher', 'admin'];
    if (role && role !== 'all' && validRoles.includes(role)) {
      query.role = role;
    }
    
    // Sanitize search input to prevent ReDoS
    if (search && typeof search === 'string' && search.trim().length > 0) {
      // Limit search length and escape special regex characters
      const sanitizedSearch = search.trim().substring(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { firstName: { $regex: sanitizedSearch, $options: 'i' } },
        { lastName: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('firstName lastName email role createdAt lastLogin profilePicture')
      .sort({ createdAt: -1 });
    
    // Get last login dates from LoginActivity for users without lastLogin field
    const userIds = users.map(u => u._id);
    const loginActivities = await LoginActivity.find({
      userId: { $in: userIds },
      success: true
    })
      .sort({ timestamp: -1 })
      .lean();
    
    // Create a map of userId -> last successful login
    const lastLoginMap = new Map();
    loginActivities.forEach(activity => {
      if (!lastLoginMap.has(activity.userId.toString())) {
        lastLoginMap.set(activity.userId.toString(), activity.timestamp);
      }
    });
    
    // Map users to include status and lastLogin (from LoginActivity if not in User model)
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      let lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
      
      // If no lastLogin in User model, get from LoginActivity
      if (!lastLoginDate) {
        const activityLogin = lastLoginMap.get(user._id.toString());
        if (activityLogin) {
          lastLoginDate = new Date(activityLogin);
          // Optionally update the User model (non-blocking)
          User.findByIdAndUpdate(user._id, { lastLogin: activityLogin }).catch(err => 
            console.error('Error updating lastLogin:', err)
          );
        }
      }
      
      // Determine status based on last login (30 days threshold)
      let status = 'active';
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // If user was created recently (within 30 days) and never logged in, consider active
      const createdAt = new Date(user.createdAt);
      const daysSinceCreation = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (lastLoginDate) {
        // Has logged in - check if recent
        if (lastLoginDate < thirtyDaysAgo) {
          status = 'inactive';
        }
      } else {
        // Never logged in
        if (daysSinceCreation > 30) {
          status = 'inactive';
        }
        // If created recently (within 30 days), keep as active
      }
      
      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: status,
        lastLogin: lastLoginDate,
        createdAt: user.createdAt,
        profilePicture: user.profilePicture
      };
    }));
    
    // Filter by status if provided
    let filteredUsers = usersWithStatus;
    const validStatuses = ['active', 'inactive'];
    if (status && status !== 'all' && validStatuses.includes(status)) {
      filteredUsers = usersWithStatus.filter(u => u.status === status);
    }

    res.json({
      success: true,
      data: filteredUsers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get all courses for admin oversight
exports.getAllCourses = async (req, res) => {
  try {
    const { status, published, search } = req.query;
    
    const query = {};
    
    // Validate published parameter
    if (published && published !== 'all') {
      if (published === 'published' || published === 'true') {
        query.published = true;
      } else if (published === 'unpublished' || published === 'false') {
        query.published = false;
      }
    }
    
    // Sanitize search input to prevent ReDoS
    if (search && typeof search === 'string' && search.trim().length > 0) {
      // Limit search length and escape special regex characters
      const sanitizedSearch = search.trim().substring(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: sanitizedSearch, $options: 'i' } },
        { 'catalog.courseCode': { $regex: sanitizedSearch, $options: 'i' } },
        { description: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }
    
    const courses = await Course.find(query)
      .populate('instructor', 'firstName lastName')
      .select('title description instructor published students updatedAt createdAt modules catalog')
      .sort({ updatedAt: -1 });
    
    const coursesWithStats = await Promise.all(courses.map(async (course) => {
      // Get modules for this course
      const modules = await Module.find({ course: course._id }).select('_id');
      const moduleIds = modules.map(m => m._id);
      
      // Count assignments
      const assignmentCount = await Assignment.countDocuments({
        module: { $in: moduleIds }
      });
      
      // Determine status
      let status = 'active';
      if (!course.published) {
        status = 'draft';
      }
      
      return {
        _id: course._id,
        title: course.title,
        description: course.description,
        instructor: course.instructor 
          ? `${course.instructor.firstName} ${course.instructor.lastName}`
          : 'Unknown',
        published: course.published,
        enrollmentCount: course.students?.length || 0,
        assignmentCount: assignmentCount,
        catalog: course.catalog,
        createdAt: course.createdAt,
        lastUpdated: course.updatedAt,
        status: status
      };
    }));
    
    // Filter by status if provided
    let filteredCourses = coursesWithStats;
    const validStatuses = ['active', 'draft'];
    if (status && status !== 'all' && validStatuses.includes(status)) {
      filteredCourses = coursesWithStats.filter(c => c.status === status);
    }

    res.json({
      success: true,
      data: filteredCourses
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
};

// @desc    Get security statistics
// @route   GET /api/admin/security/stats
// @access  Private (Admin)
exports.getSecurityStats = async (req, res) => {
  try {
    // Get total successful logins
    const totalLogins = await LoginActivity.countDocuments({ success: true });
    
    // Get failed logins (last 30 days for suspicious activities)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const failedLogins = await LoginActivity.countDocuments({ 
      success: false,
      timestamp: { $gte: thirtyDaysAgo }
    });
    
    // Suspicious activities - multiple failed logins from same IP in short time
    // For now, we'll count IPs with 5+ failed attempts in last 24 hours as suspicious
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const suspiciousIPs = await LoginActivity.aggregate([
      {
        $match: {
          success: false,
          timestamp: { $gte: oneDayAgo }
        }
      },
      {
        $group: {
          _id: '$ipAddress',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gte: 5 }
        }
      }
    ]);
    const suspiciousActivities = suspiciousIPs.length;
    
    // Blocked IPs - not implemented yet, return 0
    const blockedIPs = 0;
    
    // Calculate security score (0-100)
    // Perfect score starts at 100, deduct points for issues
    let securityScore = 100;
    if (failedLogins > 0) {
      // Deduct up to 30 points based on failed login ratio
      const totalAttempts = await LoginActivity.countDocuments({ timestamp: { $gte: thirtyDaysAgo } });
      // Prevent division by zero
      if (totalAttempts > 0) {
        const failureRate = (failedLogins / totalAttempts) * 100;
        securityScore -= Math.min(30, failureRate / 10);
      }
    }
    if (suspiciousActivities > 0) {
      // Deduct up to 20 points for suspicious activities
      securityScore -= Math.min(20, suspiciousActivities * 5);
    }
    securityScore = Math.max(0, Math.round(securityScore));
    
    res.json({
      success: true,
      data: {
        totalLogins,
        failedLogins,
        suspiciousActivities,
        blockedIPs,
        securityScore
      }
    });
  } catch (err) {
    console.error('Error in getSecurityStats:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching security statistics',
      error: err.message
    });
  }
};

// @desc    Get security events
// @route   GET /api/admin/security/events
// @access  Private (Admin)
exports.getSecurityEvents = async (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 50;
    // Validate limit is a positive integer
    if (isNaN(limit) || limit < 1) {
      limit = 50;
    }
    if (limit > 500) {
      limit = 500; // Cap at 500 for performance
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get recent login activities
    const activities = await LoginActivity.find({
      timestamp: { $gte: thirtyDaysAgo }
    })
    .populate('userId', 'firstName lastName email')
    .sort({ timestamp: -1 })
    .limit(limit);
    
    // Convert to security events format
    const events = activities.map((activity) => {
      if (!activity) return null;
      
      let type = 'login_attempt';
      let severity = 'low';
      let description = '';
      
      if (activity.success) {
        if (activity.userId && activity.userId.firstName && activity.userId.lastName && activity.userId.email) {
          description = `Successful login: ${activity.userId.firstName} ${activity.userId.lastName} (${activity.userId.email})`;
        } else if (activity.userId && activity.userId.email) {
          description = `Successful login: ${activity.userId.email}`;
        } else {
          description = 'Successful login';
        }
      } else {
        type = 'failed_login';
        severity = 'medium';
        if (activity.userId && activity.userId.email) {
          description = `Failed login attempt: ${activity.userId.email} - ${activity.failureReason || 'Invalid credentials'}`;
        } else {
          description = `Failed login attempt: ${activity.failureReason || 'User not found'}`;
        }
      }
      
      return {
        id: activity._id ? activity._id.toString() : '',
        type,
        description,
        timestamp: activity.timestamp ? activity.timestamp.toISOString() : new Date().toISOString(),
        severity,
        ipAddress: activity.ipAddress || 'Unknown',
        userAgent: activity.userAgent || 'Unknown'
      };
    }).filter(event => event !== null);
    
    res.json({
      success: true,
      data: events
    });
  } catch (err) {
    console.error('Error in getSecurityEvents:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching security events',
      error: err.message
    });
  }
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    
    // Don't send the password in response
    const settingsResponse = settings.toObject();
    if (settingsResponse.email && settingsResponse.email.smtpPassword) {
      settingsResponse.email.smtpPassword = settingsResponse.email.smtpPassword ? '***' : '';
    }
    
    res.json({
      success: true,
      data: settingsResponse
    });
  } catch (err) {
    console.error('Error in getSystemSettings:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching system settings',
      error: err.message
    });
  }
};

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin)
exports.updateSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      // Create new settings if none exist
      settings = new SystemSettings(req.body);
    } else {
      // Update existing settings
      if (req.body.general) {
        settings.general = { ...settings.general, ...req.body.general };
      }
      if (req.body.security) {
        settings.security = { ...settings.security, ...req.body.security };
      }
      if (req.body.email) {
        // Only update password if a new one is provided (not '***')
        const emailUpdate = { ...req.body.email };
        if (emailUpdate.smtpPassword === '***' || emailUpdate.smtpPassword === '') {
          delete emailUpdate.smtpPassword;
        }
        settings.email = { ...settings.email, ...emailUpdate };
      }
      if (req.body.storage) {
        settings.storage = { ...settings.storage, ...req.body.storage };
      }
    }
    
    await settings.save();
    
    // Don't send the password in response
    const settingsResponse = settings.toObject();
    if (settingsResponse.email && settingsResponse.email.smtpPassword) {
      settingsResponse.email.smtpPassword = '***';
    }
    
    res.json({
      success: true,
      data: settingsResponse,
      message: 'System settings updated successfully'
    });
  } catch (err) {
    console.error('Error in updateSystemSettings:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating system settings',
      error: err.message
    });
  }
};

// @desc    Test email configuration
// @route   POST /api/admin/settings/test-email
// @access  Private (Admin)
exports.testEmailConfig = async (req, res) => {
  try {
    // For now, return a placeholder response
    // TODO: Implement actual email sending functionality
    res.json({
      success: true,
      message: 'Email test functionality is not yet implemented. Configuration saved successfully.'
    });
  } catch (err) {
    console.error('Error in testEmailConfig:', err);
    res.status(500).json({
      success: false,
      message: 'Error testing email configuration',
      error: err.message
    });
  }
};

