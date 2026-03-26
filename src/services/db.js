const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const schema = require('../schema/index');
const { logger } = require('../config');

let db = null;

function getDb() {
  if (db) return db;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = neon(databaseUrl);
  db = drizzle(sql, { schema: schema });
  logger.info('Database connection established');
  return db;
}

async function pingDb() {
  try {
    const database = getDb();
    const sql = neon(process.env.DATABASE_URL);
    await sql('SELECT 1');
    return true;
  } catch (err) {
    logger.error({ err: err }, 'Database ping failed');
    return false;
  }
}

module.exports = { getDb, pingDb };
