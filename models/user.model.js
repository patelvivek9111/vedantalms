const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  bio: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  },
  preferences: {
    language: { type: String, default: 'en' },
    timeZone: { type: String, default: 'UTC' },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    showOnlineStatus: { type: Boolean, default: true },
    courseColors: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    courseQuickLinks: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error); // Pass error to Mongoose error handler
  }
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  const payload = { 
    id: this._id,
    role: this.role,
    email: this.email 
  };
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-123';
  const expire = process.env.JWT_EXPIRE || '30d';
  const token = jwt.sign(payload, secret, { expiresIn: expire });
  return token;
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) {
    return false; // User has no password set (shouldn't happen, but safety check)
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 