import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['workplace', 'meeting', 'followup', 'business', 'personal', 'urgent', 'general'],
      default: 'general',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

emailTemplateSchema.index({ isSystem: 1, userId: 1, category: 1 });
emailTemplateSchema.index({ title: 'text', subject: 'text', tags: 'text' });

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

export default EmailTemplate;
