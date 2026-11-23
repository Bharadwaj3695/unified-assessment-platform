const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      default: 'Computer Science & Engineering',
      trim: true,
    },
    examCategories: {
      type: [String],
      enum: ['COMPETITIVE', 'INSTITUTIONAL', 'PRACTICE', 'PLACEMENT', 'GENERAL'],
      default: ['INSTITUTIONAL'],
    },
    examIds: {
      type: [String],
      default: [],
    },
    units: [
      {
        unitNumber: { type: Number, required: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subjectSchema.index({ code: 1, isActive: 1 });
subjectSchema.index({ examCategories: 1 });

subjectSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

const Subject = mongoose.model('Subject', subjectSchema);
module.exports = Subject;
