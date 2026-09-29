import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import mongodb from 'mongodb';

const { GridFSBucket, ObjectId } = mongodb;

/**
 * Migration: Store profile pictures into MongoDB GridFS and backfill all missing fields
 */
export async function up(db) {
  console.log('[Migration] Starting profile picture database storage & data normalization...');

  // 1. Ensure GridFS user_avatars collections and indexes exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  if (!collectionNames.includes('user_avatars.files')) {
    await db.createCollection('user_avatars.files');
  }
  await db.collection('user_avatars.files').createIndex({ filename: 1, uploadDate: -1 }, { background: true });

  if (!collectionNames.includes('user_avatars.chunks')) {
    await db.createCollection('user_avatars.chunks');
  }
  await db.collection('user_avatars.chunks').createIndex({ files_id: 1, n: 1 }, { unique: true, background: true });

  // 2. Migrate existing avatar files on disk into MongoDB GridFS
  const avatarBucket = new GridFSBucket(db, { bucketName: 'user_avatars' });
  const avatarDir = path.resolve(process.cwd(), 'uploads/avatars');

  if (fs.existsSync(avatarDir)) {
    const avatarFiles = fs.readdirSync(avatarDir).filter((f) => !f.startsWith('.'));
    console.log(`[Migration] Found ${avatarFiles.length} avatar file(s) on disk to migrate to MongoDB GridFS.`);

    for (const filename of avatarFiles) {
      try {
        const filePath = path.join(avatarDir, filename);
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) continue;

        // Check if already in GridFS
        const existing = await db.collection('user_avatars.files').findOne({ filename });
        let gridFsId = existing?._id;

        if (!existing) {
          const buffer = fs.readFileSync(filePath);
          const ext = path.extname(filename).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
          };
          const contentType = mimeTypes[ext] || 'image/jpeg';

          gridFsId = await new Promise((resolve, reject) => {
            const uploadStream = avatarBucket.openUploadStream(filename, {
              contentType,
              metadata: { uploadedAt: new Date(), source: 'disk_migration' },
            });
            uploadStream.on('error', reject);
            uploadStream.on('finish', () => resolve(uploadStream.id));

            const readable = new Readable();
            readable.push(buffer);
            readable.push(null);
            readable.pipe(uploadStream);
          });
          console.log(`[Migration] Uploaded avatar [${filename}] to MongoDB GridFS with ID: ${gridFsId}`);
        }

        // Link avatar to corresponding user in MongoDB
        // Filename pattern is usually avatar-<userId>-<timestamp>.<ext>
        const match = filename.match(/^avatar-([a-f0-9]{24})-/i);
        const relativeUrl = `/api/uploads/avatars/${filename}`;

        if (match && match[1]) {
          const userId = new ObjectId(match[1]);
          await db.collection('users').updateOne(
            { _id: userId },
            {
              $set: {
                profilePictureGridFsId: gridFsId,
                profilePictureUrl: relativeUrl,
                updatedAt: new Date(),
              },
            }
          );
          console.log(`[Migration] Linked GridFS avatar ID ${gridFsId} to User ID ${userId}`);
        } else {
          // Alternatively match by profilePictureUrl
          await db.collection('users').updateMany(
            { profilePictureUrl: { $regex: filename } },
            {
              $set: {
                profilePictureGridFsId: gridFsId,
                profilePictureUrl: relativeUrl,
                updatedAt: new Date(),
              },
            }
          );
        }
      } catch (err) {
        console.warn(`[Migration] Warning migrating avatar ${filename}:`, err.message);
      }
    }
  }

  // 3. User collection normalization
  console.log('[Migration] Normalizing User schema defaults and timestamps...');
  const users = await db.collection('users').find({}).toArray();
  for (const u of users) {
    const updates = {};
    if (u.dob === undefined) updates.dob = null;
    if (u.gender === undefined) updates.gender = null;
    if (u.profilePictureUrl === undefined) updates.profilePictureUrl = null;
    if (u.profilePictureGridFsId === undefined) updates.profilePictureGridFsId = null;
    if (u.aliasIds === undefined) updates.aliasIds = [];
    if (u.updatedAt === undefined) updates.updatedAt = u.createdAt || new Date();

    if (Object.keys(updates).length > 0) {
      await db.collection('users').updateOne({ _id: u._id }, { $set: updates });
    }
  }

  // Ensure index on users
  try {
    await db.collection('users').createIndex({ phone: 1 }, { unique: true, background: true });
    await db.collection('users').createIndex({ email: 1 }, { sparse: true, background: true });
  } catch (_) {}

  // 4. Message collection normalization
  console.log('[Migration] Normalizing Message schema defaults...');
  await db.collection('messages').updateMany(
    { isSpam: { $exists: false } },
    { $set: { isSpam: false, spamScore: 0, spamReason: '' } }
  );

  await db.collection('messages').updateMany(
    { userStatuses: { $exists: false } },
    { $set: { userStatuses: [] } }
  );

  await db.collection('messages').updateMany(
    { ccEmails: { $exists: false } },
    { $set: { ccEmails: [], cc: [] } }
  );

  await db.collection('messages').updateMany(
    { bccEmails: { $exists: false } },
    { $set: { bccEmails: [], bcc: [] } }
  );

  await db.collection('messages').updateMany(
    { toEmails: { $exists: false } },
    { $set: { toEmails: [] } }
  );

  // 5. Thread collection normalization
  console.log('[Migration] Normalizing Thread schema defaults...');
  await db.collection('threads').updateMany(
    { bccParticipants: { $exists: false } },
    { $set: { bccParticipants: [] } }
  );

  await db.collection('threads').updateMany(
    { participantEmails: { $exists: false } },
    { $set: { participantEmails: [] } }
  );

  console.log('[Migration] Database normalization and avatar migration completed successfully!');
}

export async function down(db) {
  try {
    await db.collection('user_avatars.files').drop();
    await db.collection('user_avatars.chunks').drop();
    await db.collection('users').updateMany(
      {},
      { $unset: { profilePictureGridFsId: '' } }
    );
  } catch (err) {
    console.warn('[Migration Down] Notice:', err.message);
  }
}
