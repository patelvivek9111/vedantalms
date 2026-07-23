const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { resolveJwtSecret } = require('../utils/jwtSecret');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

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
      'platform_admin',
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
  },
  /** Registrar student record (Phase R3). Optional for non-students. */
  studentProfile: {
    studentId: { type: String, default: '', trim: true },
    admissionNumber: { type: String, default: '', trim: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
    batch: { type: String, default: '', trim: true },
    currentYear: { type: Number, default: null },
    division: { type: String, default: '', trim: true },
    dateOfBirth: { type: Date, default: null },
    guardianName: { type: String, default: '', trim: true },
    guardianPhone: { type: String, default: '', trim: true },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    documents: [
      {
        type: { type: String, default: '', trim: true },
        fileAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset', default: null },
        verifiedAt: { type: Date, default: null },
        label: { type: String, default: '', trim: true },
      },
    ],
    externalIds: {
      sis: { type: String, default: '', trim: true },
    },
  },
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
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
    rid: this.rootAccountId ? String(this.rootAccountId) : undefined,
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

userSchema.plugin(tenantScopePlugin);

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ rootAccountId: 1, role: 1, email: 1 });
userSchema.index(
  { rootAccountId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
userSchema.index({ rootAccountId: 1, 'studentProfile.admissionNumber': 1 });
userSchema.index({ rootAccountId: 1, 'studentProfile.studentId': 1 });
userSchema.index({ rootAccountId: 1, 'studentProfile.programId': 1 });
userSchema.index(
  { rootAccountId: 1, 'studentProfile.externalIds.sis': 1 },
  {
    partialFilterExpression: {
      'studentProfile.externalIds.sis': { $type: 'string', $gt: '' },
    },
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User; 