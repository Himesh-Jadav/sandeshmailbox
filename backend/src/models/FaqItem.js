import mongoose from 'mongoose';

const faqItemSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['general', 'auth', 'security', 'smtp', 'account'],
      default: 'general',
    },
    isSuggested: {
      type: Boolean,
      default: false,
    },
    keywords: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'faqs',
  }
);

faqItemSchema.index({ isSuggested: 1, order: 1 });
faqItemSchema.index({ question: 'text', answer: 'text', keywords: 'text' });

const FaqItem = mongoose.model('FaqItem', faqItemSchema);

export default FaqItem;
