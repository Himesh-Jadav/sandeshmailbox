import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  sendMailViaSmtp,
  getUserThreads,
  getThreadMessages,
  markThreadAsRead,
  verifyRecipientUser,
  moveMessageToFolder,
  permanentlyDeleteMessage,
  saveDraft,
  updateDraft,
  getDraftsForUser,
  deleteDraft,
  sendDraft,
  emptySpam,
} from '../services/mail.service.js';
import { downloadFromGridFS } from '../utils/gridfs.js';
import { BadRequestError } from '../utils/errors.js';
import EmailTemplate from '../models/EmailTemplate.js';
import { generateEmailWithAi } from '../services/groqEmail.service.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const aiDraftRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'You have generated several AI emails. Please wait a moment before trying again.',
});

// Configure multer memory storage for file uploads (up to 25MB total per request)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
    files: 5,
  },
});

/**
 * GET /api/mail/attachments/:id
 * Streams an attachment file directly from MongoDB GridFS.
 */
router.get('/attachments/:id', async (req, res, next) => {
  try {
    const { stream, fileInfo } = await downloadFromGridFS(req.params.id);

    res.setHeader('Content-Type', fileInfo.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', fileInfo.length);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileInfo.filename)}"`);

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * All remaining mail routes require valid session JWT
 */
router.use(requireAuth);

/**
 * GET /api/mail/threads?folder=inbox
 * Retrieves all conversation threads for logged-in user, scoped to a folder.
 * folder: 'inbox' | 'sent' | 'trash' | 'archive' | 'starred'
 */
router.get('/threads', async (req, res, next) => {
  try {
    const folder = req.query.folder || 'inbox';
    const threads = await getUserThreads(req.user._id, folder);
    res.json({ threads });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/mail/threads/:threadId
 * Retrieves all messages for a specific conversation thread and marks as read
 */
router.get('/threads/:threadId', async (req, res, next) => {
  try {
    const data = await getThreadMessages(req.params.threadId, req.user._id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/mail/threads/:threadId/read
 * Marks all messages in a thread as read immediately
 */
router.patch('/threads/:threadId/read', async (req, res, next) => {
  try {
    const data = await markThreadAsRead(req.params.threadId, req.user._id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mail/send
 * Sends an email via local self-hosted SMTP server on port 2525
 * Supports multipart file attachments via multer.
 * Optional body param: threadId — when present this is a reply to an existing thread.
 * When absent a brand new thread is always created.
 */
router.post('/send', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const { to, cc, bcc, subject, text, threadId } = req.body;
    if (!to) {
      throw new BadRequestError('Recipient "to" field is required');
    }

    const result = await sendMailViaSmtp({
      fromUser: req.user,
      toInput: to,
      ccInput: cc,
      bccInput: bcc,
      subject: subject || '',
      text: text || '',
      files: req.files || [],
      existingThreadId: threadId || null,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/mail/messages/:id/move
 * Moves a message to a folder for the requesting user only.
 * Body: { folder: 'inbox' | 'trash' | 'archive' | 'spam' }
 */
router.patch('/messages/:id/move', async (req, res, next) => {
  try {
    const { folder } = req.body;
    if (!folder) {
      throw new BadRequestError('folder field is required');
    }
    const result = await moveMessageToFolder(req.params.id, req.user._id, folder);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mail/spam/empty
 * Empties all spam messages for the requesting user (moves to trash).
 */
router.delete('/spam/empty', async (req, res, next) => {
  try {
    const result = await emptySpam(req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mail/messages/:id
 * Permanently deletes a message. The message must already be in Trash for this user.
 */
router.delete('/messages/:id', async (req, res, next) => {
  try {
    const result = await permanentlyDeleteMessage(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Draft Routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/mail/drafts
 * Lists all drafts for the authenticated user.
 */
router.get('/drafts', async (req, res, next) => {
  try {
    const drafts = await getDraftsForUser(req.user._id);
    res.json({ drafts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mail/drafts
 * Saves a new draft. Does NOT send it.
 */
router.post('/drafts', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const { to, cc, bcc, subject, text, threadId } = req.body;
    const draft = await saveDraft({
      fromUser: req.user,
      toInput: to || '',
      ccInput: cc || '',
      bccInput: bcc || '',
      subject: subject || '',
      text: text || '',
      files: req.files || [],
      threadId: threadId || null,
    });
    res.status(201).json({ draft });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/mail/drafts/:id
 * Updates an existing draft.
 */
router.patch('/drafts/:id', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const { to, cc, bcc, subject, text } = req.body;
    const draft = await updateDraft(req.params.id, req.user._id, {
      toInput: to,
      ccInput: cc,
      bccInput: bcc,
      subject,
      text,
    });
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mail/drafts/:id
 * Discards (permanently removes) a draft.
 */
router.delete('/drafts/:id', async (req, res, next) => {
  try {
    const result = await deleteDraft(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mail/drafts/:id/send
 * Converts a draft into a real sent message.
 */
router.post('/drafts/:id/send', async (req, res, next) => {
  try {
    const result = await sendDraft(req.params.id, req.user);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ── Recipient Verification ────────────────────────────────────────────────────

/**
 * GET /api/mail/verify-recipient?query=...
 * Checks whether a given recipient phone or @phonemail.com address is registered
 */
router.get('/verify-recipient', async (req, res, next) => {
  try {
    const query = req.query.query;
    if (!query) {
      throw new BadRequestError('Recipient query parameter is required');
    }

    const result = await verifyRecipientUser(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/mail/recipient-key?query=...
 * Returns the public key of a recipient for End-to-End Encryption
 */
router.get('/recipient-key', async (req, res, next) => {
  try {
    const query = req.query.query;
    if (!query) {
      throw new BadRequestError('Recipient query parameter is required');
    }

    const result = await verifyRecipientUser(query);
    if (!result.exists) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    res.json({
      publicKey: result.user?.publicKey || null,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

// ── Topic-Based Predefined Templates ──────────────────────────────────────────

/**
 * GET /api/mail/templates
 * Returns list of email templates (system predefined + user's custom templates)
 */
router.get('/templates', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = {
      $or: [
        { isSystem: true },
        { userId: req.user._id },
      ],
    };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ];
    }

    const templates = await EmailTemplate.find(filter)
      .sort({ usageCount: -1, updatedAt: -1 })
      .limit(60);

    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mail/templates
 * Create a custom user template
 */
router.post('/templates', async (req, res, next) => {
  try {
    const { title, subject, body, category = 'general', tags = [] } = req.body;
    if (!title || !subject || !body) {
      throw new BadRequestError('Title, subject, and body are required for an email template');
    }

    const template = await EmailTemplate.create({
      title: title.trim(),
      subject: subject.trim(),
      body: body.trim(),
      category,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()) : [],
      isSystem: false,
      userId: req.user._id,
    });

    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mail/templates/:id
 * Delete a user's custom template
 */
router.delete('/templates/:id', async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isSystem: false,
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not deletable' });
    }

    await template.deleteOne();
    res.json({ success: true, message: 'Template removed' });
  } catch (err) {
    next(err);
  }
});

// ── AI Email Generation via Groq ──────────────────────────────────────────────

/**
 * POST /api/mail/ai/generate
 * Generates an email template/draft based on a user's prompt using Groq
 */
router.post('/ai/generate', aiDraftRateLimiter, async (req, res, next) => {
  try {
    const { prompt, tone, length, recipientContext, currentSubject } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new BadRequestError('A prompt or topic description is required');
    }

    const result = await generateEmailWithAi({
      prompt: prompt.trim(),
      tone: tone || 'professional',
      length: length || 'medium',
      recipientContext: recipientContext || '',
      currentSubject: currentSubject || '',
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
