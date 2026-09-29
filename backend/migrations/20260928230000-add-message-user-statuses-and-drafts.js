export const up = async (db) => {
  // 1. Add userStatuses, isDraft, draftFor defaults to all existing messages
  await db.collection('messages').updateMany(
    { userStatuses: { $exists: false } },
    { $set: { userStatuses: [], isDraft: false, draftFor: null } }
  );

  // 2. Create compound index for per-user folder queries
  await db.collection('messages').createIndex(
    { 'userStatuses.userId': 1, 'userStatuses.folder': 1 },
    { sparse: true, background: true }
  );

  // 3. Create draft index
  await db.collection('messages').createIndex(
    { isDraft: 1, draftFor: 1 },
    { sparse: true, background: true }
  );
};

export const down = async (db) => {
  await db.collection('messages').updateMany(
    {},
    { $unset: { userStatuses: '', isDraft: '', draftFor: '' } }
  );

  try {
    await db.collection('messages').dropIndex('userStatuses.userId_1_userStatuses.folder_1');
  } catch (_) {}

  try {
    await db.collection('messages').dropIndex('isDraft_1_draftFor_1');
  } catch (_) {}
};
