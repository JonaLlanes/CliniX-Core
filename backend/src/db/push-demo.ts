/**
 * Copy the local demo database to MongoDB Atlas.
 *
 * Seed first (`npm run seed`), then:
 *   $env:TARGET_MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster.mongodb.net/clinix_core"
 *   npm run db:push
 *
 * Reads only localhost. Replaces collections on the target. Does not run inside Render.
 */
import mongoose from 'mongoose';
import { config } from '../config/env.js';

const targetUri = process.argv[2] || process.env.TARGET_MONGODB_URI;

function hostOf(uri: string) {
  const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, 'http://');
  return new URL(normalized).hostname;
}

async function pushDemo() {
  if (!targetUri) {
    throw new Error(
      'Set TARGET_MONGODB_URI to the Atlas connection string, or pass it as the first argument.'
    );
  }

  const sourceHost = hostOf(config.mongoUri);
  if (sourceHost !== 'localhost' && sourceHost !== '127.0.0.1') {
    throw new Error(`Refusing to read from ${sourceHost}. Seed the local database, then push that copy.`);
  }

  const targetHost = hostOf(targetUri);
  if (targetHost === 'localhost' || targetHost === '127.0.0.1') {
    throw new Error('Refusing to push onto localhost. Pass the Atlas connection string.');
  }
  if (targetUri === config.mongoUri) {
    throw new Error('Source and target are the same database.');
  }

  const source = mongoose.createConnection(config.mongoUri);
  const target = mongoose.createConnection(targetUri);
  await Promise.all([source.asPromise(), target.asPromise()]);

  const sourceDb = source.db;
  const targetDb = target.db;
  if (!sourceDb || !targetDb) throw new Error('Database connection did not open.');

  const collections = (await sourceDb.listCollections().toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('system.'));

  if (collections.length === 0) {
    throw new Error('Local database has no collections. Run npm run seed first.');
  }

  console.log(`Pushing ${collections.length} collections from ${sourceHost} to ${targetHost}...`);
  let total = 0;

  for (const name of collections) {
    const cursor = sourceDb.collection(name).find({});
    const batchSize = 500;
    let batch: mongoose.mongo.OptionalId<mongoose.mongo.Document>[] = [];
    let count = 0;
    await targetDb.collection(name).deleteMany({});
    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= batchSize) {
        await targetDb.collection(name).insertMany(batch, { ordered: false });
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      await targetDb.collection(name).insertMany(batch, { ordered: false });
      count += batch.length;
    }
    total += count;
    console.log(`  ${name}: ${count.toLocaleString()}`);
  }

  if (total === 0) {
    throw new Error('Local collections are empty. Run npm run seed first.');
  }

  console.log(`Push complete. ${total.toLocaleString()} documents are on ${targetHost}.`);
  await Promise.all([source.close(), target.close()]);
}

pushDemo().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
