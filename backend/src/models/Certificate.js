// Import Mongoose ODM library for schema definition and database persistence
const mongoose = require('mongoose');

// Mongoose schema representing an issued institutional credential award
const certificateSchema = new mongoose.Schema(
  {
    // Unique public-facing certificate identifier (e.g. CERT-2026-B817E2)
    certificateId: {
      type: String,
      required: [true, 'Certificate ID is required'],
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    // Foreign key referencing the recipient student User account
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Foreign key referencing the parent Assessment
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    // Foreign key referencing the qualifying Submission attempt
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
    },
    // Foreign key referencing the authoritative Evaluation document
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evaluation',
      default: null,
    },
    // Foreign key referencing the CertificateTemplate used for rendering
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CertificateTemplate',
      required: true,
    },
    // Immutable snapshot of the template version counter at issuance time
    templateVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    // Immutable frozen copy of the complete template layout elements and styling
    templateSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Immutable snapshot of authoritative academic and personal metadata at issuance time
    academicSnapshot: {
      studentName: { type: String, required: true, trim: true },
      studentIdNumber: { type: String, default: '', trim: true },
      studentEmail: { type: String, required: true, trim: true, lowercase: true },
      assessmentTitle: { type: String, required: true, trim: true },
      certificateTitle: { type: String, required: true, trim: true },
      category: { type: String, default: 'General', trim: true },
      score: { type: Number, required: true },
      totalPoints: { type: Number, required: true },
      percentage: { type: Number, required: true },
      grade: { type: String, required: true, trim: true },
      gradeLabel: { type: String, default: '', trim: true },
      passingPercentage: { type: Number, required: true },
      instructorName: { type: String, default: '', trim: true },
      signatoryName: { type: String, default: '', trim: true },
      signatoryTitle: { type: String, default: 'Dean of Academic Affairs', trim: true },
    },
    // Credential validity lifecycle state
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    // Metadata describing revocation circumstances if certificate is revoked
    revocation: {
      revokedAt: { type: Date, default: null },
      revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, default: '', trim: true },
    },
    // Cryptographically secure verification token used for URL routing and tamper detection
    verificationCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Timestamp when certificate was initially awarded
    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound uniqueness: exactly one certificate award per student per assessment
certificateSchema.index({ studentId: 1, assessmentId: 1 }, { unique: true });

// Index for chronological certificate queries
certificateSchema.index({ issuedAt: -1 });

// Virtual populating recipient student User details
certificateSchema.virtual('student', {
  ref: 'User',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true,
});

// Virtual populating associated Assessment details
certificateSchema.virtual('assessment', {
  ref: 'Assessment',
  localField: 'assessmentId',
  foreignField: '_id',
  justOne: true,
});

// Configure JSON serialization transformation
certificateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const Certificate = mongoose.model('Certificate', certificateSchema);
module.exports = Certificate;
