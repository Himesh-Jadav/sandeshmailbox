import 'dotenv/config';

// migrate-mongo-config.js
// https://github.com/seppevs/migrate-mongo#configuration

import fs from 'fs';
import path from 'path';

let mongoUrl = process.env.MONGODB_URI;

// Check if local persistent MongoDB fallback is active
const localUriPath = path.resolve('./.local-mongo-uri');
if (fs.existsSync(localUriPath)) {
  try {
    const localUri = fs.readFileSync(localUriPath, 'utf8').trim();
    if (localUri) {
      mongoUrl = localUri.endsWith('/') ? `${localUri}phonemail` : `${localUri}/phonemail`;
    }
  } catch (_) {}
}

const config = {
  mongodb: {
    url: mongoUrl,
    databaseName: 'phonemail',
    options: {
      serverSelectionTimeoutMS: 4000,
    },
  },

  // The migrations directory, relative to this config file.
  migrationsDir: 'migrations',

  // The mongodb collection where applied migrations are stored.
  changelogCollectionName: 'changelog',

  // The file extension for migration files.
  migrationFileExtension: '.js',

  // Enable ES module support so migration files can use `export`.
  useFileHash: false,
  moduleSystem: 'esm',
};

export const {
  mongodb,
  migrationsDir,
  changelogCollectionName,
  migrationFileExtension,
  useFileHash,
  moduleSystem,
} = config;

export default config;
