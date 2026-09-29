import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { up as runMigration } from '../migrations/20260929143000-store-avatars-and-backfill-missing-fields.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function getUri() {
  const uriFile = path.resolve(process.cwd(), '.local-mongo-uri');
  if (fs.existsSync(uriFile)) {
    const localUri = fs.readFileSync(uriFile, 'utf8').trim();
    if (localUri) return localUri;
  }
  return process.env.MONGODB_URI;
}

async function execute() {
  const uri = await getUri();
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  console.log('Connected to DB. Running migration...');

  await runMigration(mongoose.connection.db);

  console.log('\n--- VERIFYING USER AVATARS & FIELDS IN MONGODB ---');
  const usersWithAvatars = await mongoose.connection.db.collection('users').find({
    profilePictureUrl: { $ne: null }
  }).toArray();

  for (const u of usersWithAvatars) {
    console.log({
      displayName: u.displayName,
      phone: u.phone,
      profilePictureUrl: u.profilePictureUrl,
      profilePictureGridFsId: u.profilePictureGridFsId?.toString(),
      dob: u.dob,
      gender: u.gender,
      updatedAt: u.updatedAt
    });
  }

  const avatarFilesCount = await mongoose.connection.db.collection('user_avatars.files').countDocuments();
  const avatarChunksCount = await mongoose.connection.db.collection('user_avatars.chunks').countDocuments();
  console.log(`\nGridFS user_avatars.files count: ${avatarFilesCount}`);
  console.log(`GridFS user_avatars.chunks count: ${avatarChunksCount}`);

  await mongoose.disconnect();
  console.log('\nMigration execution and verification completed successfully!');
}

execute().catch(err => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
