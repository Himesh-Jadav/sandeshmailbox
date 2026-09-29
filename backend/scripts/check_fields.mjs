import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function getUri() {
  const uriFile = path.resolve(process.cwd(), '.local-mongo-uri');
  if (fs.existsSync(uriFile)) {
    const localUri = fs.readFileSync(uriFile, 'utf8').trim();
    if (localUri) return localUri;
  }
  return process.env.MONGODB_URI;
}

async function run() {
  const uri = await getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });

  console.log('=== USERS SUMMARY ===');
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  for (const u of users) {
    console.log({
      id: u._id.toString(),
      phone: u.phone,
      email: u.email,
      displayName: u.displayName,
      hasSetPassword: u.hasSetPassword,
      createdVia: u.createdVia,
      dob: u.dob,
      gender: u.gender,
      profilePictureUrl: u.profilePictureUrl,
      publicKey: u.publicKey ? 'SET' : 'null',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    });
  }

  console.log('\n=== MESSAGES SUMMARY (total:', await mongoose.connection.db.collection('messages').countDocuments(), ') ===');
  const messages = await mongoose.connection.db.collection('messages').find({}).limit(5).toArray();
  for (const m of messages) {
    console.log({
      id: m._id.toString(),
      threadId: m.threadId?.toString(),
      messageId: m.messageId,
      inReplyTo: m.inReplyTo,
      fromEmail: m.fromEmail,
      toEmails: m.toEmails,
      ccEmails: m.ccEmails,
      bccEmails: m.bccEmails,
      subject: m.subject,
      hasText: Boolean(m.text),
      hasHtml: Boolean(m.html),
      attachmentsCount: (m.attachments || []).length,
      userStatusesCount: (m.userStatuses || []).length,
      isSpam: m.isSpam,
      spamScore: m.spamScore,
      isDraft: m.isDraft,
      draftFor: m.draftFor,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    });
  }

  console.log('\n=== THREADS SUMMARY (total:', await mongoose.connection.db.collection('threads').countDocuments(), ') ===');
  const threads = await mongoose.connection.db.collection('threads').find({}).limit(5).toArray();
  for (const t of threads) {
    console.log({
      id: t._id.toString(),
      subject: t.subject,
      participantsCount: (t.participants || []).length,
      participantEmails: t.participantEmails,
      bccParticipantsCount: (t.bccParticipants || []).length,
      lastMessage: t.lastMessage,
      lastMessageAt: t.lastMessageAt,
      unreadCounts: t.unreadCounts,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    });
  }

  await mongoose.disconnect();
}

run().catch(console.error);
