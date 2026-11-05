/**
 * Ontario outpatient seed for CliniX Core.
 *
 * Builds a 36-month panel for Toronto Main, North York, Mississauga, and Virtual:
 * 35 staff, 500 patients, and the clinical volumes used by CliniX Insight.
 * Faker supplies names. Clinical choices use a fixed RNG so a rerun matches.
 *
 *   npm run seed
 *   npm run seed -- --dry
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import { config } from '../config/env.js';
import { buildAudits } from './seed/audit.js';
import { assertWorld } from './seed/check.js';
import { buildChart } from './seed/chart.js';
import { clearCollections, demoSeedIsComplete, persistWorld } from './seed/persist.js';
import { buildSchedule } from './seed/schedule.js';
import { createWorld } from './seed/world.js';

const dry = process.argv.includes('--dry');
const hostedDemo = process.env.SEED_DEMO_DATA === 'true';

async function seed() {
  if (!dry && hostedDemo && process.env.SEED_FORCE !== 'true') {
    await connectDb();
    const alreadySeeded = await demoSeedIsComplete();
    // A database copied with db:push has the full panel and no seed marker.
    const patients = await mongoose.connection.collection('patients').countDocuments();
    const vitals = await mongoose.connection.collection('vitals').countDocuments();
    const panelPresent = patients >= 500 && vitals >= 15000;
    if (!alreadySeeded && panelPresent) {
      await mongoose.connection.collection('seedmeta').updateOne(
        { _id: 'demo' },
        { $set: { complete: true, finishedAt: new Date(), source: 'existing' } },
        { upsert: true }
      );
    }
    await disconnectDb();
    if (alreadySeeded || panelPresent) {
      console.log('Demo data already present. Skipping seed. Set SEED_FORCE=true to replace it.');
      return;
    }
  }

  console.log('Building the Ontario clinic panel...');
  const world = await createWorld();
  const board = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(world.now);
  console.log(`Operational board is ${board}.`);
  buildSchedule(world);
  console.log(`Appointments ${world.appointments.length.toLocaleString()}, visits ${world.visits.length.toLocaleString()}.`);
  buildChart(world);
  console.log('Charts built. Writing the audit log...');
  buildAudits(world);
  assertWorld(world);

  console.log(
    dry
      ? 'Checking documents against the Mongoose models...'
      : hostedDemo
        ? 'Checking documents before replacing the hosted demo...'
        : 'Checking documents before replacing local data...'
  );
  await persistWorld(world, false);
  if (dry) {
    console.log('Dry run passed. Nothing was written to MongoDB.');
    return;
  }

  const host = new URL(config.mongoUri.replace(/^mongodb(\+srv)?:\/\//, 'http://')).hostname;
  if (!hostedDemo && host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `Refusing to replace data on ${host}. Local seed only runs against localhost. Hosted deploys set SEED_DEMO_DATA=true.`
    );
  }

  await mongoose.connect(config.mongoUri, { autoIndex: false });
  try {
    const patients = mongoose.connection.collection('patients');
    const indexes = await patients.indexes();
    for (const index of indexes) {
      const keys = Object.values(index.key ?? {});
      if (keys.includes('text') && index.name) await patients.dropIndex(index.name);
    }
  } catch {
    // The patients collection is created on the first insert.
  }
  await mongoose.disconnect();

  await connectDb();
  console.log('Clearing collections...');
  await clearCollections();
  console.log('Inserting validated documents...');
  await persistWorld(world);
  console.log('');
  console.log('Seed complete. Demo logins:');
  console.log('  admin@clinix.local        / Admin123!');
  console.log('  doctor@clinix.local       / Doctor123!');
  console.log('  nurse@clinix.local        / Nurse123!');
  console.log('  caregiver@clinix.local    / Caregiver123!');
  console.log('  pharmacist@clinix.local   / Pharm123!');
  console.log('  insight@clinix.local      / Insight123!');
  console.log('  r.okafor@clinix.local     / Doctor123!');
  console.log('Additional staff in each role use that role\'s demo password.');
  console.log('Open Ava Nguyen (MRN-1001) for the showcase chart.');
  await disconnectDb();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
