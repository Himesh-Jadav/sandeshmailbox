import mongoose from 'mongoose';

const threadSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    participantEmails: {
      type: [String],
      default: [],
    },
    bccParticipants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    subject: {
      type: String,
      default: 'No Subject',
      trim: true,
    },
    lastMessage: {
      text: { type: String, default: '' },
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
      hasAttachments: { type: Boolean, default: false },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

threadSchema.index({ participants: 1 });
threadSchema.index({ bccParticipants: 1 });
threadSchema.index({ lastMessageAt: -1 });

export const Thread = mongoose.model('Thread', threadSchema);
export default Thread;
