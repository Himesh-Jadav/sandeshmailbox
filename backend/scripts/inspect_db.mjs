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
  console.log('Connecting to MongoDB at:', uri.replace(/\/\/[^@]+@/, '//<credentials>@'));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  console.log('Connected successfully!');

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n--- COLLECTIONS IN DATABASE ---');
  for (const c of collections) {
    const collName = c.name;
    const count = await mongoose.connection.db.collection(collName).countDocuments();
    const indexes = await mongoose.connection.db.collection(collName).indexes();
    console.log(`\n========================================`);
    console.log(`Collection: [${collName}] (Total documents: ${count})`);
    console.log('Indexes:', indexes.map(idx => `${idx.name}: (${Object.keys(idx.key).join(', ')})`));
    
    // Sample document
    const sample = await mongoose.connection.db.collection(collName).findOne();
    if (sample) {
      console.log('Fields present in sample document:');
      const keysWithTypes = {};
      for (const [k, v] of Object.entries(sample)) {
        keysWithTypes[k] = v === null ? 'null' : Array.isArray(v) ? `Array[${v.length}]` : typeof v;
      }
      console.log(JSON.stringify(keysWithTypes, null, 2));
      console.log('Sample Document:');
      console.log(JSON.stringify(sample, null, 2));
    }
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Inspect error:', err.message);
  process.exit(1);
});
