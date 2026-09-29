export const up = async (db, client) => {
  const collections = await db.listCollections({ name: 'users' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('users');
  }
  await db.collection('users').createIndex({ phone: 1 }, { unique: true });
};

export const down = async (db, client) => {
  const collections = await db.listCollections({ name: 'users' }).toArray();
  if (collections.length > 0) {
    await db.collection('users').drop();
  }
};
