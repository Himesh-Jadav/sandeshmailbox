/**
 * Migration: Add spam detection fields and indexes to messages collection
 */
export async function up(db) {
  try {
    await db.collection('messages').updateMany(
      { isSpam: { $exists: false } },
      {
        $set: {
          isSpam: false,
          spamScore: 0,
          spamReason: '',
        },
      }
    );

    await db.collection('messages').createIndex({ isSpam: 1, createdAt: -1 }, { background: true });
    await db.collection('messages').createIndex(
      { 'userStatuses.userId': 1, 'userStatuses.folder': 1 },
      { background: true }
    );
  } catch (err) {
    // Indexes might already exist
    console.warn('Migration up notice:', err.message);
  }
}

export async function down(db) {
  try {
    await db.collection('messages').dropIndex('isSpam_1_createdAt_-1');
  } catch (err) {
    console.warn('Migration down notice:', err.message);
  }
}
