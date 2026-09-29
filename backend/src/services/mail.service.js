import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import pino from 'pino';
import User from '../models/User.js';
import Thread from '../models/Thread.js';
import Message from '../models/Message.js';
import { parseRecipientPhone, toEmailAddress } from '../utils/phone.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { uploadToGridFS, downloadFromGridFS } from '../utils/gridfs.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525', 10);

/**
 * Creates Nodemailer transporter configured for local self-hosted SMTP server
 */
const transporter = nodemailer.createTransport({
  host: '127.0.0.1',
  port: SMTP_PORT,
  secure: false,
  ignoreTLS: true,
  tls: {
    rejectUnauthorized: false,
  },
});

function parseRecipientList(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Sends an email through the local SMTP server on port 2525 with TO, CC, and BCC.
 * If existingThreadId is provided the message is appended to that thread (reply).
 * If existingThreadId is absent a brand new thread is always created (new compose).
 *
 * @param {object} params
 * @param {object} params.fromUser           User document of sender
 * @param {string|string[]} params.toInput   Recipient phone(s) or email(s)
 * @param {string|string[]} [params.ccInput] CC recipient phone(s) or email(s)
 * @param {string|string[]} [params.bccInput] BCC recipient phone(s) or email(s)
 * @param {string} params.subject            Subject of the email
 * @param {string} params.text               Message body
 * @param {Array<Express.Multer.File>} [params.files] Uploaded files from multer
 * @param {string} [params.existingThreadId] When replying, append to this thread
 * @returns {Promise<object>} Result of sending
 */
export async function sendMailViaSmtp({
  fromUser,
  toInput,
  ccInput = '',
  bccInput = '',
  subject,
  text,
  files = [],
  existingThreadId = null,
}) {
  const toRawList = parseRecipientList(toInput);
  if (!toRawList.length) {
    throw new BadRequestError('Recipient "to" field is required. Please enter at least one recipient.');
  }

  const toPhones = toRawList.map((item) => parseRecipientPhone(item)).filter(Boolean);
  if (toPhones.length !== toRawList.length) {
    throw new BadRequestError('One or more recipients in "to" has an invalid phone number or email format.');
  }

  const toUsers = await User.find({ phone: { $in: toPhones } });
  if (toUsers.length !== toPhones.length) {
    throw new NotFoundError(
      'One or more recipients in "to" does not exist. Only registered PhoneMail users can receive mail.'
    );
  }

  // Parse CC
  const ccRawList = parseRecipientList(ccInput);
  const ccPhones = ccRawList.map((item) => parseRecipientPhone(item)).filter(Boolean);
  if (ccPhones.length !== ccRawList.length) {
    throw new BadRequestError('One or more recipients in "cc" has an invalid phone number or email format.');
  }
  const ccUsers = ccPhones.length ? await User.find({ phone: { $in: ccPhones } }) : [];
  if (ccUsers.length !== ccPhones.length) {
    throw new NotFoundError('One or more recipients in "cc" does not exist on PhoneMail.');
  }

  // Parse BCC
  const bccRawList = parseRecipientList(bccInput);
  const bccPhones = bccRawList.map((item) => parseRecipientPhone(item)).filter(Boolean);
  if (bccPhones.length !== bccRawList.length) {
    throw new BadRequestError('One or more recipients in "bcc" has an invalid phone number or email format.');
  }
  const bccUsers = bccPhones.length ? await User.find({ phone: { $in: bccPhones } }) : [];
  if (bccUsers.length !== bccPhones.length) {
    throw new NotFoundError('One or more recipients in "bcc" does not exist on PhoneMail.');
  }

  const fromEmail = toEmailAddress(fromUser.phone);
  const toEmails = toUsers.map((u) => toEmailAddress(u.phone));
  const ccEmails = ccUsers.map((u) => toEmailAddress(u.phone));
  const bccEmails = bccUsers.map((u) => toEmailAddress(u.phone));
  const emailSubject = (subject && subject.trim()) || 'Chat Message';

  // ── Thread resolution (before sending via SMTP) ──────────────────────────
  // If existingThreadId provided: it's a REPLY → append to that thread.
  // Otherwise: it's a new compose / forward → ALWAYS create a fresh thread.
  let thread;
  let inReplyToMessageId = null;

  if (existingThreadId) {
    // Validate the thread exists and the sender is a participant
    thread = await Thread.findOne({
      _id: existingThreadId,
      $or: [{ participants: fromUser._id }, { bccParticipants: fromUser._id }],
    });
    if (!thread) {
      throw new NotFoundError('Thread not found or access denied for reply.');
    }

    const lastMsg = await Message.findOne({ threadId: existingThreadId, isDraft: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('messageId');
    if (lastMsg?.messageId) {
      inReplyToMessageId = lastMsg.messageId;
    }
  } else {
    // ── New Compose or Forward → always create brand new thread ────────────
    const visibleParticipantIds = Array.from(
      new Set([
        fromUser._id.toString(),
        ...toUsers.map((u) => u._id.toString()),
        ...ccUsers.map((u) => u._id.toString()),
      ])
    );

    const bccParticipantIds = bccUsers.map((u) => u._id.toString());

    const isE2ee = (text || '').trim().startsWith('-----BEGIN SANDESH E2EE MESSAGE-----');
    const lastSnippet = isE2ee ? (text || '').trim().slice(0, 4000) : (text || '').slice(0, 200);

    thread = new Thread({
      participants: visibleParticipantIds,
      participantEmails: [fromEmail, ...toEmails, ...ccEmails],
      bccParticipants: bccParticipantIds,
      subject: emailSubject,
      lastMessage: {
        text: lastSnippet,
        from: fromUser._id,
        createdAt: new Date(),
        hasAttachments: files.length > 0,
      },
      lastMessageAt: new Date(),
      unreadCounts: Object.fromEntries(
        [...toUsers, ...ccUsers, ...bccUsers].map((u) => [u._id.toString(), 1])
      ),
    });
    await thread.save();
  }

  // Format attachments for nodemailer
  const mailAttachments = files.map((file) => ({
    filename: file.originalname,
    content: file.buffer,
    contentType: file.mimetype,
  }));

  try {
    const headers = {
      'X-Thread-ID': thread._id.toString(),
    };
    if (inReplyToMessageId) {
      headers['In-Reply-To'] = inReplyToMessageId;
      headers['References'] = inReplyToMessageId;
    }

    const mailOptions = {
      from: fromEmail,
      to: toEmails,
      subject: emailSubject,
      text: text || '',
      attachments: mailAttachments,
      headers,
    };
    if (ccEmails.length) {
      mailOptions.cc = ccEmails;
    }
    if (bccEmails.length) {
      mailOptions.bcc = bccEmails;
    }

    const info = await transporter.sendMail(mailOptions);

    logger.info(
      {
        messageId: info.messageId,
        threadId: thread._id.toString(),
        toCount: toEmails.length,
        ccCount: ccEmails.length,
        bccCount: bccEmails.length,
        existingThreadId,
      },
      'Mail sent successfully via local SMTP'
    );

    return {
      success: true,
      messageId: info.messageId,
      threadId: thread._id.toString(),
      recipient: {
        phone: toUsers[0].phone,
        email: toEmails[0],
        displayName: toUsers[0].displayName || toUsers[0].phone,
      },
      toEmails,
      ccEmails,
      bccEmails,
    };
  } catch (err) {
    logger.error({ err, to: toUsers.map((u) => u.phone) }, 'Failed to dispatch email via local SMTP transporter');
    throw err instanceof BadRequestError || err instanceof NotFoundError
      ? err
      : new BadRequestError(err.message || 'Failed to dispatch email through local SMTP server');
  }
}

/**
 * Retrieves all conversational threads for a user, scoped to a folder.
 * Folder logic:
 *  - 'inbox'   : messages where user has no status entry OR folder='inbox', excluding drafts
 *  - 'sent'    : threads where user is the sender of the last message
 *  - 'trash'   : threads where ALL messages for this user have folder='trash'
 *  - 'archive' : threads where ALL messages for this user have folder='archive'
 *  - 'starred' : all non-trashed threads (pinned is client-side only, so same as inbox)
 *
 * For inbox/sent/starred we return threads that have at least one message NOT in trash/archive.
 *
 * @param {string} userId
 * @param {string} [folder='inbox']
 */
export async function getUserThreads(userId, folder = 'inbox') {
  const userIdStr = userId.toString();

  const userAccessFilter = {
    $or: [
      { from: userId },
      { to: userId },
      { cc: userId },
      { bcc: userId },
      { 'userStatuses.userId': userId },
    ],
  };

  let messageFilter;

  if (folder === 'trash') {
    messageFilter = {
      isDraft: false,
      userStatuses: {
        $elemMatch: { userId: userId, folder: 'trash' },
      },
    };
  } else if (folder === 'archive') {
    messageFilter = {
      isDraft: false,
      userStatuses: {
        $elemMatch: { userId: userId, folder: 'archive' },
      },
    };
  } else if (folder === 'spam') {
    messageFilter = {
      isDraft: false,
      $or: [
        { userStatuses: { $elemMatch: { userId: userId, folder: 'spam' } } },
        {
          isSpam: true,
          from: { $ne: userId },
          userStatuses: {
            $not: { $elemMatch: { userId: userId, folder: { $in: ['inbox', 'trash', 'archive'] } } },
          },
        },
      ],
    };
  } else if (folder === 'sent') {
    messageFilter = {
      isDraft: false,
      from: userId,
      $nor: [
        { userStatuses: { $elemMatch: { userId: userId, folder: 'trash' } } },
      ],
    };
  } else {
    // inbox / starred: show messages not in trash, archive, or spam
    messageFilter = {
      isDraft: false,
      $nor: [
        { userStatuses: { $elemMatch: { userId: userId, folder: 'trash' } } },
        { userStatuses: { $elemMatch: { userId: userId, folder: 'archive' } } },
        { userStatuses: { $elemMatch: { userId: userId, folder: 'spam' } } },
        {
          isSpam: true,
          from: { $ne: userId },
          userStatuses: {
            $not: { $elemMatch: { userId: userId, folder: 'inbox' } },
          },
        },
      ],
    };
  }

  // Get distinct threadIds matching the filter for this user using $and to avoid key collision
  const relevantMessages = await Message.find({
    $and: [
      userAccessFilter,
      messageFilter,
    ],
  })
    .select('threadId from createdAt')
    .lean();

  const threadIdSet = new Set(relevantMessages.map((m) => m.threadId?.toString()).filter(Boolean));

  if (threadIdSet.size === 0) return [];

  const threads = await Thread.find({
    _id: { $in: Array.from(threadIdSet) },
    $or: [{ participants: userId }, { bccParticipants: userId }],
  })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'phone displayName profilePictureUrl publicKey')
    .lean();

  return threads.map((thread) => {
    const otherParticipants = (thread.participants || []).filter(
      (p) => p._id.toString() !== userIdStr
    );
    const primaryContact = otherParticipants[0] || thread.participants[0];

    const unreadCount = thread.unreadCounts?.[userIdStr] || 0;

    return {
      id: thread._id.toString(),
      subject: thread.subject,
      lastMessage: thread.lastMessage,
      lastMessageAt: thread.lastMessageAt,
      unreadCount,
      contact: primaryContact
        ? {
          id: primaryContact._id.toString(),
          phone: primaryContact.phone,
          email: toEmailAddress(primaryContact.phone),
          displayName:
            otherParticipants.length > 1
              ? `${primaryContact.displayName || primaryContact.phone} +${otherParticipants.length - 1}`
              : primaryContact.displayName || primaryContact.phone,
          profilePictureUrl: primaryContact.profilePictureUrl || null,
          publicKey: primaryContact.publicKey || null,
        }
        : null,
    };
  });
}

/**
 * Retrieves messages for a specific thread and marks them as read by the user
 * @param {string} threadId
 * @param {string} userId
 */
export async function getThreadMessages(threadId, userId) {
  const thread = await Thread.findOne({
    _id: threadId,
    $or: [{ participants: userId }, { bccParticipants: userId }],
  })
    .populate('participants', 'phone displayName profilePictureUrl publicKey')
    .lean();

  if (!thread) {
    throw new NotFoundError('Thread not found or access denied');
  }

  const [requestingUser, messages] = await Promise.all([
    User.findById(userId).select('phone').lean(),
    Message.find({ threadId, isDraft: { $ne: true } })
      .sort({ createdAt: 1 })
      .populate('from', 'phone displayName profilePictureUrl publicKey')
      .lean(),
    // Mark all unread messages as read by this user
    Message.updateMany(
      { threadId, isDraft: { $ne: true }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    ),
    // Reset unread count for this user in thread
    Thread.updateOne(
      { _id: threadId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    ),
  ]);
  const requestingEmail = requestingUser ? toEmailAddress(requestingUser.phone) : '';

  const otherParticipants = (thread.participants || []).filter(
    (p) => p._id.toString() !== userId.toString()
  );
  const primaryContact = otherParticipants[0] || thread.participants[0];

  return {
    thread: {
      id: thread._id.toString(),
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt,
      contact: primaryContact
        ? {
          id: primaryContact._id.toString(),
          phone: primaryContact.phone,
          email: toEmailAddress(primaryContact.phone),
          displayName:
            otherParticipants.length > 1
              ? `${primaryContact.displayName || primaryContact.phone} +${otherParticipants.length - 1}`
              : primaryContact.displayName || primaryContact.phone,
          profilePictureUrl: primaryContact.profilePictureUrl || null,
          publicKey: primaryContact.publicKey || null,
        }
        : null,
    },
    messages: messages.map((m) => {
      const isSender = m.from?._id ? m.from._id.toString() === userId.toString() : false;
      const isBccUser = (m.bcc || []).some(
        (b) => (b._id ? b._id.toString() : b.toString()) === userId.toString()
      );

      // Strict BCC Privacy Filter
      let visibleBccEmails = [];
      if (isSender) {
        visibleBccEmails = m.bccEmails || [];
      } else if (isBccUser) {
        visibleBccEmails = (m.bccEmails || []).filter((e) => e === requestingEmail);
      }

      // Get this user's folder status for the message
      const userStatus = (m.userStatuses || []).find(
        (s) => s.userId?.toString() === userId.toString()
      );

      return {
        id: m._id.toString(),
        threadId: m.threadId?.toString(),
        from: {
          id: m.from?._id ? m.from._id.toString() : m.from,
          phone: m.from?.phone || '',
          displayName: m.from?.displayName || m.from?.phone || '',
          email: m.fromEmail,
          profilePictureUrl: m.from?.profilePictureUrl || null,
          publicKey: m.from?.publicKey || null,
        },
        fromEmail: m.fromEmail,
        toEmails: m.toEmails || [],
        ccEmails: m.ccEmails || [],
        bccEmails: visibleBccEmails,
        subject: m.subject,
        text: m.text,
        html: m.html,
        attachments: (m.attachments || []).map((a) => ({
          id: a._id ? a._id.toString() : a.gridFsId.toString(),
          filename: a.filename,
          gridFsId: a.gridFsId.toString(),
          contentType: a.contentType,
          size: a.size,
        })),
        isMine: isSender,
        read: m.readBy?.some((r) => r.toString() !== m.from?._id?.toString()),
        folder: userStatus?.folder || (m.isSpam && !isSender ? 'spam' : (isSender ? 'sent' : 'inbox')),
        isSpam: m.isSpam || userStatus?.folder === 'spam',
        spamScore: m.spamScore || 0,
        spamReason: m.spamReason || (userStatus?.folder === 'spam' ? 'Marked as spam by user' : ''),
        createdAt: m.createdAt,
      };
    }),
  };
}

/**
 * Marks all messages in a thread as read by the user and resets unread count
 * @param {string} threadId
 * @param {string} userId
 */
export async function markThreadAsRead(threadId, userId) {
  const thread = await Thread.findOne({
    _id: threadId,
    $or: [{ participants: userId }, { bccParticipants: userId }],
  }).select('_id');

  if (!thread) {
    throw new NotFoundError('Thread not found or access denied');
  }

  await Promise.all([
    Message.updateMany(
      { threadId, isDraft: { $ne: true }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    ),
    Thread.updateOne(
      { _id: threadId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    ),
  ]);

  return { success: true };
}

/**
 * Moves a message or thread to a folder for the given user.
 * Supports both message ID and thread ID, as well as drafts.
 * Only affects this user's view — other participants are unaffected.
 *
 * @param {string} targetId Message ID or Thread ID
 * @param {string} userId
 * @param {'trash'|'archive'|'inbox'} folder
 */
export async function moveMessageToFolder(targetId, userId, folder) {
  const validFolders = ['inbox', 'trash', 'archive', 'spam'];
  if (!validFolders.includes(folder)) {
    throw new BadRequestError(`Invalid folder "${folder}". Must be one of: ${validFolders.join(', ')}`);
  }

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new BadRequestError('Invalid ID format');
  }

  const userIdStr = userId.toString();

  // 1. Check if targetId is an unsent Draft
  const draft = await Message.findOne({ _id: targetId, isDraft: true, draftFor: userId });
  if (draft) {
    if (folder === 'trash') {
      await Message.deleteOne({ _id: targetId });
      logger.info({ draftId: targetId, userId }, 'Draft removed via move to trash');
      return { success: true, messageId: targetId, folder };
    }
  }

  // 2. Try to find messages matching targetId as Message _id
  let messages = await Message.find({
    _id: targetId,
    isDraft: { $ne: true },
    $or: [
      { from: userId },
      { to: userId },
      { cc: userId },
      { bcc: userId },
      { 'userStatuses.userId': userId },
    ],
  });

  // 2b. If not found by sender/recipient, check if user is a participant of the message's thread
  if (!messages || messages.length === 0) {
    const singleMsg = await Message.findOne({ _id: targetId, isDraft: { $ne: true } });
    if (singleMsg && singleMsg.threadId) {
      const thread = await Thread.findOne({
        _id: singleMsg.threadId,
        $or: [{ participants: userId }, { bccParticipants: userId }],
      });
      if (thread) {
        messages = [singleMsg];
      }
    }
  }

  // 3. If not found as Message, check if targetId is a Thread _id
  if (!messages || messages.length === 0) {
    const thread = await Thread.findOne({
      _id: targetId,
      $or: [{ participants: userId }, { bccParticipants: userId }],
    });

    if (thread) {
      messages = await Message.find({
        threadId: targetId,
        isDraft: { $ne: true },
      });
    }
  }

  // 4. Fallback for Thread if user was in messages but not yet thread participant array
  if (!messages || messages.length === 0) {
    messages = await Message.find({
      threadId: targetId,
      isDraft: { $ne: true },
      $or: [
        { from: userId },
        { to: userId },
        { cc: userId },
        { bcc: userId },
        { 'userStatuses.userId': userId },
      ],
    });
  }

  if (!messages || messages.length === 0) {
    throw new NotFoundError('Message not found or access denied');
  }

  const now = new Date();
  const statusEntry = {
    userId,
    folder,
    trashedAt: folder === 'trash' ? now : null,
    archivedAt: folder === 'archive' ? now : null,
    spammedAt: folder === 'spam' ? now : null,
  };

  for (const message of messages) {
    if (!message.userStatuses) {
      message.userStatuses = [];
    }
    const existingIdx = message.userStatuses.findIndex(
      (s) => s.userId?.toString() === userIdStr
    );

    if (existingIdx >= 0) {
      message.userStatuses[existingIdx] = statusEntry;
    } else {
      message.userStatuses.push(statusEntry);
    }

    await message.save();
  }

  logger.info({ targetId, count: messages.length, userId, folder }, 'Message(s) moved to folder');
  return { success: true, messageId: targetId, folder };
}

/**
 * Permanently deletes a message or thread for the requesting user.
 * Supports both message ID and thread ID, as well as drafts.
 * If all user statuses are deleted, the message document is fully removed.
 *
 * @param {string} targetId Message ID or Thread ID
 * @param {string} userId
 */
export async function permanentlyDeleteMessage(targetId, userId) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new BadRequestError('Invalid ID format');
  }

  const userIdStr = userId.toString();

  // 1. Check if targetId is a Draft
  const draft = await Message.findOne({ _id: targetId, isDraft: true, draftFor: userId });
  if (draft) {
    await Message.deleteOne({ _id: targetId });
    logger.info({ draftId: targetId, userId }, 'Draft permanently deleted');
    return { success: true };
  }

  // 2. Try finding as Message _id
  let messages = await Message.find({
    _id: targetId,
    isDraft: { $ne: true },
    $or: [
      { from: userId },
      { to: userId },
      { cc: userId },
      { bcc: userId },
      { 'userStatuses.userId': userId },
    ],
  });

  if (!messages || messages.length === 0) {
    const singleMsg = await Message.findOne({ _id: targetId, isDraft: { $ne: true } });
    if (singleMsg && singleMsg.threadId) {
      const thread = await Thread.findOne({
        _id: singleMsg.threadId,
        $or: [{ participants: userId }, { bccParticipants: userId }],
      });
      if (thread) {
        messages = [singleMsg];
      }
    }
  }

  // 3. Try finding as Thread _id
  let isThreadDelete = false;
  let targetThread = null;
  if (!messages || messages.length === 0) {
    targetThread = await Thread.findOne({
      _id: targetId,
      $or: [{ participants: userId }, { bccParticipants: userId }],
    });

    if (targetThread) {
      isThreadDelete = true;
      messages = await Message.find({
        threadId: targetId,
        isDraft: { $ne: true },
      });
    }
  }

  if (!messages || messages.length === 0) {
    throw new NotFoundError('Message not found or access denied');
  }

  for (const message of messages) {
    message.userStatuses = (message.userStatuses || []).filter(
      (s) => s.userId?.toString() !== userIdStr
    );

    const isOnlyOwner =
      message.from?.toString() === userIdStr && message.userStatuses.length === 0;

    if (isOnlyOwner) {
      await Message.deleteOne({ _id: message._id });
    } else {
      await message.save();
    }
  }

  if (isThreadDelete && targetThread) {
    targetThread.participants = (targetThread.participants || []).filter(
      (p) => p.toString() !== userIdStr
    );
    targetThread.bccParticipants = (targetThread.bccParticipants || []).filter(
      (p) => p.toString() !== userIdStr
    );

    if (targetThread.participants.length === 0 && targetThread.bccParticipants.length === 0) {
      await Thread.deleteOne({ _id: targetThread._id });
    } else {
      await targetThread.save();
    }
  }

  logger.info({ targetId, count: messages.length, userId }, 'Message(s) permanently deleted');
  return { success: true };
}

// ── Draft CRUD ────────────────────────────────────────────────────────────────

/**
 * Saves a new draft message (not yet sent).
 *
 * @param {object} params
 * @param {object} params.fromUser Owner of the draft
 * @param {string} [params.toInput]
 * @param {string} [params.ccInput]
 * @param {string} [params.bccInput]
 * @param {string} [params.subject]
 * @param {string} [params.text]
 * @param {Array} [params.files]
 */
export async function saveDraft({ fromUser, toInput = '', ccInput = '', bccInput = '', subject = '', text = '', files = [], threadId = null }) {
  const fromEmail = toEmailAddress(fromUser.phone);

  // Process attachments for storage in MongoDB GridFS
  const attachmentsMeta = [];
  if (files && files.length > 0) {
    for (const f of files) {
      const gridFsId = await uploadToGridFS(
        f.originalname || 'attachment.dat',
        f.buffer,
        f.mimetype || 'application/octet-stream'
      );
      attachmentsMeta.push({
        filename: f.originalname || 'attachment.dat',
        contentType: f.mimetype || 'application/octet-stream',
        size: f.size || f.buffer?.length || 0,
        gridFsId,
      });
    }
  }

  const draft = new Message({
    threadId: threadId && mongoose.Types.ObjectId.isValid(threadId) ? threadId : null,
    from: fromUser._id,
    fromEmail,
    toEmails: parseRecipientList(toInput),
    ccEmails: parseRecipientList(ccInput),
    bccEmails: parseRecipientList(bccInput),
    subject: subject.trim(),
    text: text.trim(),
    attachments: attachmentsMeta,
    isDraft: true,
    draftFor: fromUser._id,
    userStatuses: [],
    readBy: [fromUser._id],
    createdAt: new Date(),
  });

  await draft.save();
  logger.info({ draftId: draft._id }, 'Draft saved with GridFS attachments');

  return formatDraft(draft);
}

/**
 * Updates an existing draft.
 *
 * @param {string} draftId
 * @param {string} userId
 * @param {object} fields  Partial fields to update
 */
export async function updateDraft(draftId, userId, { toInput, ccInput, bccInput, subject, text }) {
  const draft = await Message.findOne({ _id: draftId, isDraft: true, draftFor: userId });
  if (!draft) {
    throw new NotFoundError('Draft not found or access denied');
  }

  if (toInput !== undefined) draft.toEmails = parseRecipientList(toInput);
  if (ccInput !== undefined) draft.ccEmails = parseRecipientList(ccInput);
  if (bccInput !== undefined) draft.bccEmails = parseRecipientList(bccInput);
  if (subject !== undefined) draft.subject = subject.trim();
  if (text !== undefined) draft.text = text.trim();

  draft.updatedAt = new Date();
  await draft.save();

  return formatDraft(draft);
}

/**
 * Lists all drafts for a user.
 * @param {string} userId
 */
export async function getDraftsForUser(userId) {
  const drafts = await Message.find({ isDraft: true, draftFor: userId })
    .sort({ updatedAt: -1 })
    .lean();

  return drafts.map(formatDraft);
}

/**
 * Discards (permanently deletes) a draft.
 * @param {string} draftId
 * @param {string} userId
 */
export async function deleteDraft(draftId, userId) {
  const result = await Message.deleteOne({ _id: draftId, isDraft: true, draftFor: userId });
  if (result.deletedCount === 0) {
    throw new NotFoundError('Draft not found or access denied');
  }
  logger.info({ draftId, userId }, 'Draft deleted');
  return { success: true };
}

/**
 * Sends a draft: validates recipients, loads attachments from GridFS, sends via SMTP, creates thread+message.
 *
 * @param {string} draftId
 * @param {object} fromUser
 */
export async function sendDraft(draftId, fromUser) {
  const draft = await Message.findOne({ _id: draftId, isDraft: true, draftFor: fromUser._id });
  if (!draft) {
    throw new NotFoundError('Draft not found or access denied');
  }

  if (!draft.toEmails || draft.toEmails.length === 0) {
    throw new BadRequestError('Draft is missing recipients. Please add a "To" address before sending.');
  }

  // Load any attachments stored on draft from GridFS
  const attachedFiles = [];
  if (draft.attachments && draft.attachments.length > 0) {
    for (const att of draft.attachments) {
      try {
        const { stream } = await downloadFromGridFS(att.gridFsId);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        attachedFiles.push({
          originalname: att.filename,
          buffer: Buffer.concat(chunks),
          mimetype: att.contentType,
        });
      } catch (attErr) {
        logger.warn({ attErr: attErr.message, filename: att.filename }, 'Draft attachment read note');
      }
    }
  }

  // Send via SMTP using the draft's stored recipient data and attachments
  const result = await sendMailViaSmtp({
    fromUser,
    toInput: draft.toEmails.join(', '),
    ccInput: draft.ccEmails.join(', '),
    bccInput: draft.bccEmails.join(', '),
    subject: draft.subject || 'Chat Message',
    text: draft.text || '',
    files: attachedFiles,
    existingThreadId: draft.threadId ? draft.threadId.toString() : null,
  });

  // Delete the draft now that it's been sent
  await Message.deleteOne({ _id: draftId });
  logger.info({ draftId, threadId: result.threadId }, 'Draft sent and deleted');

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDraft(draft) {
  return {
    id: draft._id.toString(),
    to: (draft.toEmails || []).join(', '),
    cc: (draft.ccEmails || []).join(', '),
    bcc: (draft.bccEmails || []).join(', '),
    subject: draft.subject || '',
    text: draft.text || '',
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt || draft.createdAt,
  };
}

/**
 * Validates whether a given recipient exists in PhoneMail
 * @param {string} query
 */
export async function verifyRecipientUser(query) {
  const phone = parseRecipientPhone(query);
  if (!phone) {
    return { exists: false, error: 'Invalid phone or email address format' };
  }

  const user = await User.findOne({ phone }).lean();
  if (!user) {
    return { exists: false, phone, email: toEmailAddress(phone) };
  }

  return {
    exists: true,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      email: toEmailAddress(user.phone),
      displayName: user.displayName || user.phone,
      profilePictureUrl: user.profilePictureUrl || null,
      publicKey: user.publicKey || null,
    },
  };
}

/**
 * Permanently removes or trashes all messages in Spam for requesting user.
 * @param {string} userId
 */
export async function emptySpam(userId) {
  const userIdStr = userId.toString();

  const messages = await Message.find({
    isDraft: false,
    $or: [
      { userStatuses: { $elemMatch: { userId, folder: 'spam' } } },
      {
        isSpam: true,
        $or: [{ to: userId }, { cc: userId }, { bcc: userId }],
        userStatuses: { $not: { $elemMatch: { userId, folder: { $in: ['inbox', 'trash', 'archive'] } } } },
      },
    ],
  });

  let count = 0;
  for (const msg of messages) {
    msg.userStatuses = msg.userStatuses || [];
    const idx = msg.userStatuses.findIndex((s) => s.userId?.toString() === userIdStr);
    const statusEntry = {
      userId,
      folder: 'trash',
      trashedAt: new Date(),
    };
    if (idx >= 0) {
      msg.userStatuses[idx] = statusEntry;
    } else {
      msg.userStatuses.push(statusEntry);
    }
    await msg.save();
    count++;
  }

  logger.info({ userId, count }, 'Spam messages emptied to trash');
  return { success: true, count };
}

