import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load root .env first, then backend/.env (allowing override)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import pino from 'pino';
import authRoutes from './routes/auth.routes.js';
import meRoutes from './routes/me.routes.js';
import mailRoutes from './routes/mail.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import faqRoutes from './routes/faq.routes.js';
import { startSmtpServer, stopSmtpServer } from './services/smtp.service.js';
import { errorHandler } from './middleware/error.middleware.js';
import { seedEmailTemplates } from './utils/seedTemplates.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Direct Avatar Streaming from MongoDB GridFS
const streamAvatarHandler = async (req, res, next) => {
  try {
    const { downloadAvatarFromGridFS } = await import('./utils/gridfs.js');
    const { stream, fileInfo } = await downloadAvatarFromGridFS(req.params.filename);
    res.setHeader('Content-Type', fileInfo.contentType || 'image/jpeg');
    res.setHeader('Content-Length', fileInfo.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return stream.pipe(res);
  } catch (_) {
    next();
  }
};

app.get('/api/uploads/avatars/:filename', streamAvatarHandler);
app.get('/uploads/avatars/:filename', streamAvatarHandler);

const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/api/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(uploadsDir));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/webhooks/telnyx', webhookRoutes);
app.use('/api/faq', faqRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database connection ───────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

async function applyMigrations() {
  try {
    const Message = (await import('./models/Message.js')).default;
    const collection = Message.collection;

    // Migration: add userStatuses, isDraft, draftFor to existing messages
    const result = await collection.updateMany(
      { userStatuses: { $exists: false } },
      { $set: { userStatuses: [], isDraft: false, draftFor: null } }
    );
    if (result.modifiedCount > 0) {
      logger.info({ count: result.modifiedCount }, 'Applied migration: added userStatuses/isDraft/draftFor to messages');
    }

    // Migration: Ensure all email addresses use "sandesh.in"
    const replaceEmailDomain = (str) => {
      if (!str || typeof str !== 'string') return str;
      let s = str
        .replace(/@phonemail\.com/gi, '@sandesh.in')
        .replace(/@niti\.com/gi, '@sandesh.in')
        .replace(/@sandesh\.im/gi, '@sandesh.in')
        .replace(/@sandesh\.com/gi, '@sandesh.in');
      return s.replace(/([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, (match, local, domain) => {
        if (domain.toLowerCase() === 'sandesh.in') return match;
        return `${local}@sandesh.in`;
      });
    };

    const messages = await collection.find({
      $or: [
        { fromEmail: { $not: /@sandesh\.in$/i } },
        { toEmails: { $elemMatch: { $not: /@sandesh\.in$/i } } },
        { participantEmails: { $elemMatch: { $not: /@sandesh\.in$/i } } }
      ]
    }).toArray();

    for (const m of messages) {
      const fromEmail = replaceEmailDomain(m.fromEmail);
      const toEmails = (m.toEmails || []).map(replaceEmailDomain);
      const ccEmails = (m.ccEmails || []).map(replaceEmailDomain);
      const bccEmails = (m.bccEmails || []).map(replaceEmailDomain);
      await collection.updateOne(
        { _id: m._id },
        { $set: { fromEmail, toEmails, ccEmails, bccEmails } }
      );
    }

    // Ensure Thread participantEmails are @sandesh.in
    const Thread = (await import('./models/Thread.js')).default;
    const threads = await Thread.collection.find({
      participantEmails: { $elemMatch: { $not: /@sandesh\.in$/i } }
    }).toArray();
    for (const t of threads) {
      const participantEmails = (t.participantEmails || []).map(replaceEmailDomain);
      await Thread.collection.updateOne(
        { _id: t._id },
        { $set: { participantEmails } }
      );
    }

    // Ensure User emails are @sandesh.in
    const User = (await import('./models/User.js')).default;
    const users = await User.collection.find({}).toArray();
    for (const u of users) {
      const rawDigits = (u.phone || '').replace(/^\+\d{1,3}/, '');
      const expectedEmail = `${rawDigits}@sandesh.in`;
      if (u.email !== expectedEmail) {
        await User.collection.updateOne(
          { _id: u._id },
          { $set: { email: expectedEmail } }
        );
      }
    }

    // Ensure indexes exist (idempotent)
    try {
      await collection.createIndex(
        { 'userStatuses.userId': 1, 'userStatuses.folder': 1 },
        { sparse: true, background: true, name: 'userStatuses_folder_idx' }
      );
      await collection.createIndex(
        { isDraft: 1, draftFor: 1 },
        { sparse: true, background: true, name: 'draft_idx' }
      );
      logger.info('Migration indexes ensured');
    } catch (idxErr) {
      logger.warn({ err: idxErr.message }, 'Index creation note (may already exist)');
    }

    // Apply avatar database storage and field normalization migration
    try {
      const { up: runAvatarMigration } = await import(
        '../migrations/20260929143000-store-avatars-and-backfill-missing-fields.js'
      );
      await runAvatarMigration(mongoose.connection.db);
    } catch (avatarMigErr) {
      logger.warn({ err: avatarMigErr.message }, 'Avatar migration execution note');
    }
  } catch (migErr) {
    logger.error({ err: migErr.message }, 'Failed to apply migrations');
  }
}

async function seedInitialFaqs() {
  try {
    const FaqItem = (await import('./models/FaqItem.js')).default;
    const count = await FaqItem.countDocuments();
    if (count === 0) {
      const initialFaqs = [
        {
          question: 'What is PhoneMail and how does it work?',
          answer: 'PhoneMail transforms your phone number into your email address (e.g., +14126846774@sandesh.in). It enables seamless, self-hosted webmail communication between phone identities without requiring third-party email providers.',
          category: 'general',
          isSuggested: true,
          keywords: ['what', 'phonemail', 'how', 'work', 'email', 'about', 'phone number'],
          order: 1,
        },
        {
          question: 'How do I sign up or log in to my account?',
          answer: 'You can sign up via three convenient doors: (1) Web signup using instant SMS OTP, (2) Inbound phone call via automated voice IVR, or (3) Texting SIGNUP to our phone number. After initial verification, you set a password to easily log in from the web.',
          category: 'auth',
          isSuggested: true,
          keywords: ['signup', 'register', 'login', 'signin', 'account', 'doors', 'password', 'otp'],
          order: 2,
        },
        {
          question: 'Are my emails secure and private?',
          answer: 'Yes! PhoneMail implements client-side End-to-End Encryption (E2EE) powered by TweetNaCl. Message bodies are encrypted directly in your browser before leaving your device, meaning only the intended recipient can read them.',
          category: 'security',
          isSuggested: true,
          keywords: ['secure', 'security', 'encryption', 'private', 'privacy', 'tweetnacl', 'e2e', 'safe'],
          order: 3,
        },
        {
          question: 'Can I sign up via phone call or SMS?',
          answer: 'Absolutely! Dial our Telnyx phone number to hear the voice IVR setup, or send an SMS with "SIGNUP". A verified account is instantly created for your phone number, ready for you to set a password on the web.',
          category: 'auth',
          isSuggested: true,
          keywords: ['call', 'sms', 'ivr', 'text', 'voice', 'telnyx', 'phone call'],
          order: 4,
        },
        {
          question: 'Can I send emails to external domains like Gmail or Yahoo?',
          answer: 'PhoneMail v1 utilizes a self-hosted, high-speed closed-loop SMTP server built for secure communication between @sandesh.in user addresses.',
          category: 'smtp',
          isSuggested: false,
          keywords: ['external', 'gmail', 'yahoo', 'smtp', 'send', 'domain'],
          order: 5,
        },
        {
          question: 'What if I forget my password?',
          answer: 'You can verify your phone number via SMS OTP at any time on the login page to access your account and update your password.',
          category: 'auth',
          isSuggested: false,
          keywords: ['forgot', 'password', 'reset', 'recover', 'help'],
          order: 6,
        },
      ];
      await FaqItem.insertMany(initialFaqs);
      logger.info('Initial PhoneMail FAQs seeded successfully');
    }
  } catch (faqErr) {
    logger.error({ faqErr: faqErr.message }, 'Failed to seed initial FAQs');
  }
}

async function seedDemoUsers() {
  try {
    const User = (await import('./models/User.js')).default;
    const bcrypt = (await import('bcrypt')).default;
    const existing = await User.findOne({ phone: '+919876543210' });
    if (!existing) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await User.create([
        {
          phone: '+919876543210',
          displayName: 'Alice Sharma',
          passwordHash,
          hasSetPassword: true,
          createdVia: 'web',
        },
        {
          phone: '+919876543211',
          displayName: 'Bob Verma',
          passwordHash,
          hasSetPassword: true,
          createdVia: 'web',
        },
      ]);
      logger.info('Demo PhoneMail test users seeded (+919876543210 & +919876543211 with password123)');
    }
  } catch (seedErr) {
    logger.error({ seedErr }, 'Failed to seed demo users');
  }
}

const dbDir = path.resolve('./.mongo-data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const uriFile = path.resolve('./.local-mongo-uri');
let connected = false;

// 1. Try to reconnect to an already-running local MongoDB instance (sub-15ms on watch reload)
if (fs.existsSync(uriFile)) {
  try {
    const cachedUri = fs.readFileSync(uriFile, 'utf8').trim();
    if (cachedUri) {
      await mongoose.connect(cachedUri, { serverSelectionTimeoutMS: 1500 });
      logger.info({ uri: cachedUri }, 'Reconnected to running local MongoDB instance (persisting to .mongo-data)');
      connected = true;
    }
  } catch {
    try { fs.unlinkSync(uriFile); } catch (_) {}
  }
}

// 2. If not already connected to local instance, try Atlas / external MONGODB_URI
if (!connected && MONGODB_URI) {
  try {
    logger.info('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
    logger.info({ uri: MONGODB_URI.replace(/\/\/[^@]+@/, '//<credentials>@') }, 'MongoDB Atlas connected');
    connected = true;
  } catch (atlasErr) {
    logger.warn({ err: atlasErr.message }, 'MongoDB Atlas connection failed. Falling back to local MongoDB service...');
  }
}

// 3. Fallback: Connect to local MongoDB service (from docker-compose)
if (!connected) {
  try {
    logger.info('Connecting to local MongoDB service on docker network...');
    const localUri = 'mongodb://mongo:27017/phonemail';
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
    logger.info({ uri: localUri }, 'Local MongoDB service connected');
    connected = true;
  } catch (localErr) {
    logger.error({ err: localErr.message }, 'Failed to connect to local MongoDB service');
    process.exit(1);
  }
}

await seedDemoUsers();
await seedInitialFaqs();
await seedEmailTemplates();
await applyMigrations();

// ── Start Local Self-Hosted SMTP Server ───────────────────────────────────────
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525', 10);
startSmtpServer(SMTP_PORT);

// ── Start HTTP Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, smtpPort: SMTP_PORT }, 'PhoneMail backend and SMTP services ready [templates+ai enabled]');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, `Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    logger.error({ err }, 'HTTP server error');
    process.exit(1);
  }
});

// ── Graceful Process Shutdown ─────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Shutting down services gracefully...');
  try {
    if (server) server.close();
    stopSmtpServer();
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));



