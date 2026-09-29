import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    gridFsId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    contentType: {
      type: String,
      default: 'application/octet-stream',
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

/**
 * Per-user folder status for a message.
 * Each user involved in a thread gets their own status entry so they can
 * independently move messages to trash / archive without affecting others.
 */
const userStatusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    folder: {
      type: String,
      enum: ['inbox', 'sent', 'trash', 'archive', 'spam'],
      default: 'inbox',
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    spammedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      // threadId is null for unsent drafts
      index: true,
    },
    messageId: {
      type: String,
      trim: true,
      index: { sparse: true },
    },
    inReplyTo: {
      type: String,
      trim: true,
      index: { sparse: true },
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fromEmail: {
      type: String,
      required: true,
      trim: true,
    },
    to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    toEmails: {
      type: [String],
      default: [],
    },
    cc: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    ccEmails: {
      type: [String],
      default: [],
    },
    bcc: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    bccEmails: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    text: {
      type: String,
      default: '',
    },
    html: {
      type: String,
      default: '',
    },
    attachments: [attachmentSchema],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ── Per-user folder status ──────────────────────────────────────────────
    // Each participating user can independently move this message to trash/archive.
    // If a user has no entry here, the message is treated as inbox/sent (backward compat).
    userStatuses: [userStatusSchema],

    // ── Spam detection support ──────────────────────────────────────────────
    isSpam: {
      type: Boolean,
      default: false,
      index: true,
    },
    spamScore: {
      type: Number,
      default: 0,
    },
    spamReason: {
      type: String,
      default: '',
    },
    spamDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── Draft support ────────────────────────────────────────────────────────
    // When isDraft is true this is an unsaved compose that hasn't been sent yet.
    // threadId is null; draftFor identifies the owner.
    isDraft: {
      type: Boolean,
      default: false,
      index: true,
    },
    draftFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ threadId: 1, createdAt: 1 });
messageSchema.index({ isDraft: 1, draftFor: 1 }, { sparse: true });
messageSchema.index({ 'userStatuses.userId': 1, 'userStatuses.folder': 1 }, { sparse: true });
messageSchema.index({ isSpam: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;
