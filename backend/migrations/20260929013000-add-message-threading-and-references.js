export const up = async (db) => {
  // 1. Add messageId and inReplyTo indexes on messages collection
  await db.collection('messages').createIndex(
    { messageId: 1 },
    { sparse: true, background: true }
  );

  await db.collection('messages').createIndex(
    { inReplyTo: 1 },
    { sparse: true, background: true }
  );

  // 2. Ensure compound index on threads for participant lookups sorted by lastMessageAt
  await db.collection('threads').createIndex(
    { participants: 1, lastMessageAt: -1 },
    { background: true }
  );

  await db.collection('threads').createIndex(
    { subject: 1 },
    { background: true }
  );
};

export const down = async (db) => {
  try {
    await db.collection('messages').dropIndex('messageId_1');
  } catch (_) {}

  try {
    await db.collection('messages').dropIndex('inReplyTo_1');
  } catch (_) {}

  try {
    await db.collection('threads').dropIndex('participants_1_lastMessageAt_-1');
  } catch (_) {}

  try {
    await db.collection('threads').dropIndex('subject_1');
  } catch (_) {}
};
