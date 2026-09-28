const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId && this.authProvider !== 'google';
      },
      minlength: [6, 'Password must be at least 6 characters'],
    },
    googleId: {
      type: String,
      trim: true,
      default: undefined,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'both'],
      default: 'local',
      index: true,
    },
    role: {
      type: String,
      enum: ['student', 'instructor', 'admin'],
      default: 'student',
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'revoked'],
      default: 'pending',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    instituteCode: {
      type: String,
      default: null,
      trim: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    studentId: {
      type: String,
      trim: true,
      default: undefined,
    },
    facultyId: {
      type: String,
      trim: true,
      default: undefined,
    },
    adminId: {
      type: String,
      trim: true,
      default: undefined,
    },
    department: {
      type: String,
      default: null,
      trim: true,
    },
    subjectId: {
      type: String,
      default: null,
      trim: true,
    },
    subjectName: {
      type: String,
      default: null,
      trim: true,
    },
    subjectDescription: {
      type: String,
      default: null,
      trim: true,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    mfaSecret: {
      type: String,
      default: null,
    },
    mfaPendingSecret: {
      type: String,
      default: null,
    },
    mfaRecoveryCodes: [
      {
        codeHash: {
          type: String,
          required: true,
        },
        used: {
          type: Boolean,
          default: false,
        },
        usedAt: {
          type: Date,
          default: null,
        },
      },
    ],
    tokenVersion: {
      type: Number,
      default: 0,
    },
    mfaEnrolledAt: {
      type: Date,
      default: null,
    },
    mfaLastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique non-null academic identifiers and OAuth IDs using partial filter expressions
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
);
userSchema.index(
  { facultyId: 1 },
  { unique: true, partialFilterExpression: { facultyId: { $type: 'string' } } }
);
userSchema.index(
  { adminId: 1 },
  { unique: true, partialFilterExpression: { adminId: { $type: 'string' } } }
);
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);
userSchema.index({ role: 1, status: 1 });

// Track original academic identifiers and Google ID to enforce strict immutability
userSchema.post('init', function () {
  this._originalStudentId = this.studentId;
  this._originalFacultyId = this.facultyId;
  this._originalAdminId = this.adminId;
  this._originalGoogleId = this.googleId;
});

userSchema.pre('save', function (next) {
  if (!this.isNew) {
    if (this.isModified('studentId') && this._originalStudentId && this.studentId !== this._originalStudentId) {
      const err = new Error('Student ID is permanent and immutable after creation');
      err.statusCode = 400;
      return next(err);
    }
    if (this.isModified('facultyId') && this._originalFacultyId && this.facultyId !== this._originalFacultyId) {
      const err = new Error('Faculty ID is permanent and immutable after creation');
      err.statusCode = 400;
      return next(err);
    }
    if (this.isModified('adminId') && this._originalAdminId && this.adminId !== this._originalAdminId) {
      const err = new Error('Admin ID is permanent and immutable after creation');
      err.statusCode = 400;
      return next(err);
    }
    if (this.isModified('googleId') && this._originalGoogleId && this.googleId !== this._originalGoogleId) {
      const err = new Error('Google ID is permanent and cannot be modified once linked');
      err.statusCode = 400;
      return next(err);
    }
  }
  next();
});

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.password;
    delete ret.__v;
    delete ret._originalStudentId;
    delete ret._originalFacultyId;
    delete ret._originalAdminId;
    delete ret._originalGoogleId;
    delete ret.mfaSecret;
    delete ret.mfaPendingSecret;
    delete ret.mfaRecoveryCodes;
    ret.mfaEnabled = Boolean(ret.mfaEnabled);
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
module.exports = User;
