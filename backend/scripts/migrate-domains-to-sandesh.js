import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { toLocalPart } from '../src/utils/phone.js';

function replaceEmailDomain(str) {
  if (!str || typeof str !== 'string') return str;
  // Replace standalone @domains that are not @sandesh.in
  let s = str
    .replace(/@phonemail\.com/gi, '@sandesh.in')
    .replace(/@niti\.com/gi, '@sandesh.in')
    .replace(/@sandesh\.im/gi, '@sandesh.in')
    .replace(/@sandesh\.com/gi, '@sandesh.in');

  // Replace any other email domain that isn't sandesh.in
  s = s.replace(/([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, (match, local, domain) => {
    if (domain.toLowerCase() === 'sandesh.in') return match;
    return `${local}@sandesh.in`;
  });

  return s;
}

async function run() {
  const uriFile = path.resolve('./.local-mongo-uri');
  const uri = fs.existsSync(uriFile) ? fs.readFileSync(uriFile, 'utf8').trim() : process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;

  // 1. Messages
  console.log('\n--- Migrating Messages ---');
  const messages = await db.collection('messages').find({}).toArray();
  let updatedMsgCount = 0;
  for (const m of messages) {
    const newFromEmail = replaceEmailDomain(m.fromEmail);
    const newToEmails = (m.toEmails || []).map(replaceEmailDomain);
    const newCcEmails = (m.ccEmails || []).map(replaceEmailDomain);
    const newBccEmails = (m.bccEmails || []).map(replaceEmailDomain);
    const newText = replaceEmailDomain(m.text || '');
    const newHtml = replaceEmailDomain(m.html || '');

    const changed =
      newFromEmail !== m.fromEmail ||
      JSON.stringify(newToEmails) !== JSON.stringify(m.toEmails || []) ||
      JSON.stringify(newCcEmails) !== JSON.stringify(m.ccEmails || []) ||
      JSON.stringify(newBccEmails) !== JSON.stringify(m.bccEmails || []) ||
      newText !== (m.text || '') ||
      newHtml !== (m.html || '');

    if (changed) {
      await db.collection('messages').updateOne(
        { _id: m._id },
        {
          $set: {
            fromEmail: newFromEmail,
            toEmails: newToEmails,
            ccEmails: newCcEmails,
            bccEmails: newBccEmails,
            text: newText,
            html: newHtml,
          },
        }
      );
      updatedMsgCount++;
      console.log(`Updated Message [${m._id}]: from ${m.fromEmail} -> ${newFromEmail}`);
    }
  }
  console.log(`Updated ${updatedMsgCount} of ${messages.length} messages.`);

  // 2. Threads
  console.log('\n--- Migrating Threads ---');
  const threads = await db.collection('threads').find({}).toArray();
  let updatedThreadCount = 0;
  for (const t of threads) {
    const newParticipantEmails = (t.participantEmails || []).map(replaceEmailDomain);
    const changed = JSON.stringify(newParticipantEmails) !== JSON.stringify(t.participantEmails || []);

    if (changed) {
      await db.collection('threads').updateOne(
        { _id: t._id },
        {
          $set: {
            participantEmails: newParticipantEmails,
          },
        }
      );
      updatedThreadCount++;
      console.log(`Updated Thread [${t._id}]: ${JSON.stringify(t.participantEmails)} -> ${JSON.stringify(newParticipantEmails)}`);
    }
  }
  console.log(`Updated ${updatedThreadCount} of ${threads.length} threads.`);

  // 3. Users
  console.log('\n--- Migrating Users ---');
  const users = await db.collection('users').find({}).toArray();
  let updatedUserCount = 0;
  for (const u of users) {
    const localPart = toLocalPart(u.phone);
    const expectedEmail = `${localPart}@sandesh.in`;
    const newAliasIds = (u.aliasIds || []).map(replaceEmailDomain);

    const changed =
      u.email !== expectedEmail ||
      JSON.stringify(newAliasIds) !== JSON.stringify(u.aliasIds || []);

    if (changed) {
      await db.collection('users').updateOne(
        { _id: u._id },
        {
          $set: {
            email: expectedEmail,
            aliasIds: newAliasIds,
          },
        }
      );
      updatedUserCount++;
      console.log(`Updated User [${u._id}] (${u.phone}): email -> ${expectedEmail}`);
    }
  }
  console.log(`Updated ${updatedUserCount} of ${users.length} users.`);

  // 4. FAQs
  console.log('\n--- Migrating FAQs ---');
  const faqs = await db.collection('faqs').find({}).toArray();
  let updatedFaqCount = 0;
  for (const f of faqs) {
    const newAnswer = replaceEmailDomain(f.answer);
    if (newAnswer !== f.answer) {
      await db.collection('faqs').updateOne(
        { _id: f._id },
        { $set: { answer: newAnswer } }
      );
      updatedFaqCount++;
      console.log(`Updated FAQ [${f._id}]: ${f.question}`);
    }
  }
  console.log(`Updated ${updatedFaqCount} of ${faqs.length} faqs.`);

  await mongoose.disconnect();
  console.log('\nDomain migration to "sandesh.in" completed successfully!');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
