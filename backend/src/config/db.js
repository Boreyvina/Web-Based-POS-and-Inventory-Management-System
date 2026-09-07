const mysql = require('mysql2/promise');
const { db } = require('./env');

// Hosted MySQL almost always requires TLS. Set DB_SSL=true in production.
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined;

const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  ssl,
  waitForConnections: true,
  // Each serverless instance opens its own pool, and a hosted database allows
  // far fewer connections than you might expect. Keep this small when
  // deployed; 10 is fine on your own machine.
  connectionLimit: Number(process.env.DB_POOL_SIZE) || (process.env.VERCEL ? 2 : 10),
  queueLimit: 0,
  enableKeepAlive: true,
  decimalNumbers: true, // return DECIMAL as JS number, not string
});

/** Run a query and get just the rows back. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and get the first row (or undefined). */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0];
}

/**
 * Run several statements as one all-or-nothing unit.
 * Usage:  await withTransaction(async (conn) => { ... });
 * If the callback throws, everything is rolled back.
 */
async function withTransaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}

module.exports = { pool, query, queryOne, withTransaction, testConnection };
