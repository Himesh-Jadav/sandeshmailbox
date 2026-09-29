export const up = async (db, client) => {
  // 1. Threads collection & indexes
  const threadCollections = await db.listCollections({ name: 'threads' }).toArray();
  if (threadCollections.length === 0) {
    await db.createCollection('threads');
  }
  await db.collection('threads').createIndex({ participants: 1 });
  await db.collection('threads').createIndex({ lastMessageAt: -1 });

  // 2. Messages collection & indexes
  const messageCollections = await db.listCollections({ name: 'messages' }).toArray();
  if (messageCollections.length === 0) {
    await db.createCollection('messages');
  }
  await db.collection('messages').createIndex({ threadId: 1, createdAt: 1 });
  await db.collection('messages').createIndex({ from: 1 });
  await db.collection('messages').createIndex({ to: 1 });

  // 3. GridFS mail_attachments collections & indexes
  const filesCollections = await db.listCollections({ name: 'mail_attachments.files' }).toArray();
  if (filesCollections.length === 0) {
    await db.createCollection('mail_attachments.files');
  }
  await db.collection('mail_attachments.files').createIndex({ filename: 1, uploadDate: 1 });

  const chunksCollections = await db.listCollections({ name: 'mail_attachments.chunks' }).toArray();
  if (chunksCollections.length === 0) {
    await db.createCollection('mail_attachments.chunks');
  }
  await db.collection('mail_attachments.chunks').createIndex({ files_id: 1, n: 1 }, { unique: true });
};

export const down = async (db, client) => {
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);

  if (names.includes('messages')) {
    await db.collection('messages').drop();
  }
  if (names.includes('threads')) {
    await db.collection('threads').drop();
  }
  if (names.includes('mail_attachments.files')) {
    await db.collection('mail_attachments.files').drop();
  }
  if (names.includes('mail_attachments.chunks')) {
    await db.collection('mail_attachments.chunks').drop();
  }
};
