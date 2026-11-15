// Import Mongoose ODM library for schema definition and collection operations
const mongoose = require('mongoose');

// Schema representing global platform-wide configuration settings managed by administrators
const systemSettingSchema = new mongoose.Schema(
  {
    // Institutional platform branding name displayed across UI headers and emails
    platformName: {
      // String title
      type: String,
      // Default platform name
      default: 'Unified Assessment Platform',
      // Automatically trim whitespace
      trim: true,
    },
    // Global flag permitting or blocking new student self-registration applications
    registrationOpen: {
      // Boolean registration toggle
      type: Boolean,
      // Default: registrations accepted
      default: true,
    },
    // Emergency maintenance mode flag restricting student and instructor access
    maintenanceMode: {
      // Boolean maintenance toggle
      type: Boolean,
      // Default: active operational mode
      default: false,
    },
    // Global announcement or broadcast message displayed in UI banner
    announcementBanner: {
      // String broadcast message
      type: String,
      // Default empty string (no active banner)
      default: '',
      // Automatically trim whitespace
      trim: true,
    },
    // Platform-wide default passing score percentage for new assessments
    defaultPassingScore: {
      // Numeric percentage
      type: Number,
      // Default 60%
      default: 60,
      // Lower bound
      min: 0,
      // Upper bound
      max: 100,
    },
    // Master switch toggling outgoing transactional and alert email dispatches
    enableEmailNotifications: {
      // Boolean toggle
      type: Boolean,
      // Default enabled
      default: true,
    },
    // Platform-wide ceiling on single assessment attempt durations in hours
    maxAttemptDurationHours: {
      // Number of hours
      type: Number,
      // Default 4 hours
      default: 4,
      // Minimum duration bound
      min: 1,
    },
    // Official institutional technical support contact email address
    supportEmail: {
      // String email address
      type: String,
      // Default institutional support email
      default: 'support@uap.edu',
      // Automatically trim whitespace
      trim: true,
    },
    // Global default policy for permitting students to review submitted attempts
    allowStudentReview: {
      // Boolean review permission toggle
      type: Boolean,
      // Default enabled
      default: true,
    },
    // Institutional security policy: permits or forbids Email OTP as an authorized MFA method/fallback
    mfaEmailOtpEnabled: {
      type: Boolean,
      default: true,
    },
    // Institutional security policy: expiration window in minutes for email OTP codes
    mfaEmailOtpExpiryMinutes: {
      type: Number,
      default: 5,
      min: 1,
      max: 15,
    },
    // Institutional security policy: resend cooldown in seconds between email OTP requests
    mfaEmailOtpResendCooldownSeconds: {
      type: Number,
      default: 60,
      min: 10,
      max: 300,
    },
    // Institutional security policy: maximum permitted email OTP resends per login challenge
    mfaEmailOtpMaxResends: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    // Reference to the administrator User who last modified platform settings
    updatedBy: {
      // MongoDB ObjectId type
      type: mongoose.Schema.Types.ObjectId,
      // Target referenced model
      ref: 'User',
      // Default null until first admin update
      default: null,
    },
  },
  {
    // Automatically manage createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Configure JSON serialization transformation
systemSettingSchema.set('toJSON', {
  // Transform function modifying output representation
  transform: (doc, ret) => {
    // Expose stringified id property
    ret.id = ret._id.toString();
    // Strip internal document version key
    delete ret.__v;
    // Return sanitized plain object
    return ret;
  },
});

// Compile and register SystemSetting model with Mongoose
const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
// Export SystemSetting model for platform configuration endpoints
module.exports = SystemSetting;
