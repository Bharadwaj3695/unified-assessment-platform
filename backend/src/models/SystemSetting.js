const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      default: 'Unified Assessment Platform',
      trim: true,
    },
    registrationOpen: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    announcementBanner: {
      type: String,
      default: '',
      trim: true,
    },
    defaultPassingScore: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    enableEmailNotifications: {
      type: Boolean,
      default: true,
    },
    maxAttemptDurationHours: {
      type: Number,
      default: 4,
      min: 1,
    },
    supportEmail: {
      type: String,
      default: 'support@uap.edu',
      trim: true,
    },
    allowStudentReview: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

systemSettingSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
module.exports = SystemSetting;
