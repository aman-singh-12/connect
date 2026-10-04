'use strict';

/**
 * Run pending TypeORM migrations against the DB from env (same as Nest).
 * Used by Docker/production deploy before starting the API.
 */
require('reflect-metadata');

const path = require('path');
const { seed } = require('./seed-demo-data.cjs');

const configPath = path.join(
  __dirname,
  '..',
  'dist',
  'infrastructure',
  'database',
  'typeorm.config.js',
);

async function main() {
  const { default: dataSource } = require(configPath);

  await dataSource.initialize();

  try {
    const executed = await dataSource.runMigrations();
    if (executed.length > 0) {
      console.log(
        '[migrate] Applied:',
        executed.map((m) => m.name).join(', '),
      );
    } else {
      console.log('[migrate] No pending migrations');
    }

    // Seed demo workspace data so the dashboard is fully populated
    try {
      await seed(dataSource);
    } catch (seedErr) {
      console.warn('[migrate] Seeding skipped or warning:', seedErr.message);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
