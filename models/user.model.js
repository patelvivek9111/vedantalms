const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { resolveJwtSecret } = require('../utils/jwtSecret');

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
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
  privacyConsentAt: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: [
      'student',
      'teaching_assistant',
      'teacher',
      'department_admin',
      'registrar',
      'admin',
    ],
    default: 'student',
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
  },
  bio: {
    type: String,
    default: '',
    trim: true
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
    courseColors: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Ensure bio is properly handled - allow empty strings and trim whitespace
userSchema.pre('save', function(next) {
  // If bio is undefined or null, set it to empty string
  if (this.bio === undefined || this.bio === null) {
    this.bio = '';
  } else {
    // Trim whitespace (this will also handle empty strings correctly)
    this.bio = this.bio.trim();
  }
  next();
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  const payload = {
    id: this._id,
    role: this.role,
    email: this.email,
    tv: this.tokenVersion || 0,
  };
  const secret = resolveJwtSecret();
  const expire = process.env.JWT_EXPIRE || '7d';
  const token = jwt.sign(payload, secret, { expiresIn: expire });
  return token;
};

userSchema.methods.invalidateSessions = async function() {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  await this.save();
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, email: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User; 