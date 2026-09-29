/**
 * Migration: Replace legacy email domains (phonemail.com, niti.com, sandesh.im, etc.)
 * with "sandesh.in" across messages, threads, users, and faqs.
 */

function replaceEmailDomain(str) {
  if (!str || typeof str !== 'string') return str;
  let s = str
    .replace(/@phonemail\.com/gi, '@sandesh.in')
    .replace(/@niti\.com/gi, '@sandesh.in')
    .replace(/@sandesh\.im/gi, '@sandesh.in')
    .replace(/@sandesh\.com/gi, '@sandesh.in');

  s = s.replace(/([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, (match, local, domain) => {
    if (domain.toLowerCase() === 'sandesh.in') return match;
    return `${local}@sandesh.in`;
  });
  return s;
}

export const up = async (db) => {
  // 1. Messages
  const messages = await db.collection('messages').find({}).toArray();
  for (const m of messages) {
    const newFromEmail = replaceEmailDomain(m.fromEmail);
    const newToEmails = (m.toEmails || []).map(replaceEmailDomain);
    const newCcEmails = (m.ccEmails || []).map(replaceEmailDomain);
    const newBccEmails = (m.bccEmails || []).map(replaceEmailDomain);
    const newText = replaceEmailDomain(m.text || '');
    const newHtml = replaceEmailDomain(m.html || '');

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
  }

  // 2. Threads
  const threads = await db.collection('threads').find({}).toArray();
  for (const t of threads) {
    const newParticipantEmails = (t.participantEmails || []).map(replaceEmailDomain);
    await db.collection('threads').updateOne(
      { _id: t._id },
      { $set: { participantEmails: newParticipantEmails } }
    );
  }

  // 3. Users
  const users = await db.collection('users').find({}).toArray();
  for (const u of users) {
    const rawDigits = (u.phone || '').replace(/^\+\d{1,3}/, '');
    const expectedEmail = `${rawDigits}@sandesh.in`;
    const newAliasIds = (u.aliasIds || []).map(replaceEmailDomain);
    await db.collection('users').updateOne(
      { _id: u._id },
      { $set: { email: expectedEmail, aliasIds: newAliasIds } }
    );
  }

  // 4. FAQs
  const faqs = await db.collection('faqs').find({}).toArray();
  for (const f of faqs) {
    const newAnswer = replaceEmailDomain(f.answer);
    if (newAnswer !== f.answer) {
      await db.collection('faqs').updateOne(
        { _id: f._id },
        { $set: { answer: newAnswer } }
      );
    }
  }
};

export const down = async () => {
  // Reversible not required as sandesh.in is permanent domain
};
