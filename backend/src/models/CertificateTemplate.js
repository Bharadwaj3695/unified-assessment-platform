// Import Mongoose ODM library for schema definition and database persistence
const mongoose = require('mongoose');

// Sub-schema representing individual design elements placed on the certificate canvas
const templateElementSchema = new mongoose.Schema(
  {
    // Unique client/server element identifier
    id: {
      type: String,
      required: true,
      trim: true,
    },
    // Element rendering type
    type: {
      type: String,
      enum: ['text', 'image', 'qr_code', 'seal', 'signature', 'line', 'shape'],
      required: true,
    },
    // Horizontal position on canvas (percentage 0-100 or coordinate)
    x: {
      type: Number,
      required: true,
      default: 0,
    },
    // Vertical position on canvas (percentage 0-100 or coordinate)
    y: {
      type: Number,
      required: true,
      default: 0,
    },
    // Bounding box width
    width: {
      type: Number,
      default: null,
    },
    // Bounding box height
    height: {
      type: Number,
      default: null,
    },
    // Layer stack order index
    zIndex: {
      type: Number,
      default: 1,
    },
    // Text content or asset URL; supports dynamic placeholder tokens (e.g. {{studentName}}, {{grade}})
    content: {
      type: String,
      default: '',
    },
    // Element typographic, geometry, and presentation styles
    style: {
      fontFamily: { type: String, default: 'serif' },
      fontSize: { type: Number, default: 16 },
      fontWeight: { type: String, default: 'normal' },
      fontStyle: { type: String, default: 'normal' },
      color: { type: String, default: '#1F2937' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
      opacity: { type: Number, default: 1 },
      letterSpacing: { type: String, default: 'normal' },
      lineHeight: { type: Number, default: 1.4 },
    },
  },
  { _id: false }
);

// Mongoose schema representing an editable, versioned institutional certificate layout template
const certificateTemplateSchema = new mongoose.Schema(
  {
    // Descriptive title of the template (e.g. "Default Institutional Excellence Award")
    title: {
      type: String,
      required: [true, 'Certificate template title is required'],
      trim: true,
      minlength: [3, 'Template title must be at least 3 characters'],
    },
    // Optional description of template usage scope
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Document orientation
    orientation: {
      type: String,
      enum: ['landscape', 'portrait'],
      default: 'landscape',
    },
    // Physical page sizing standard
    pageSize: {
      type: String,
      enum: ['A4', 'Letter'],
      default: 'A4',
    },
    // Canvas background and geometric frame styling
    canvas: {
      backgroundColor: { type: String, default: '#FFFFFF' },
      backgroundImageUrl: { type: String, default: null },
      borderStyle: {
        type: String,
        enum: ['classic-gold', 'modern-slate', 'ornate-bronze', 'minimal-navy', 'none'],
        default: 'classic-gold',
      },
      borderColor: { type: String, default: '#D4AF37' },
      borderWidth: { type: Number, default: 8 },
    },
    // Array of customizable layout elements
    elements: {
      type: [templateElementSchema],
      default: [],
    },
    // Incremental version counter; increments upon publication of modifications
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Template publication lifecycle status
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    // Flag indicating whether this template acts as the system-wide fallback
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Foreign key referencing the administrator User who created the template
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Timestamp when template was published
    publishedAt: {
      type: Date,
      default: null,
    },
    // Timestamp when template was archived
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populating creator user details
certificateTemplateSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
});

// Virtual alias 'name' for title
certificateTemplateSchema.virtual('name')
  .get(function () {
    return this.title;
  })
  .set(function (v) {
    this.title = v;
  });

// Pre-validate hook to ensure title is populated if name was passed
certificateTemplateSchema.pre('validate', function (next) {
  if (!this.title && this.get('name')) {
    this.title = this.get('name');
  }
  next();
});

// Configure JSON serialization transformation
certificateTemplateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const CertificateTemplate = mongoose.model('CertificateTemplate', certificateTemplateSchema);
module.exports = CertificateTemplate;
