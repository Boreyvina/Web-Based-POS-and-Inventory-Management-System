const mysql = require('mysql2/promise');
const { db } = require('./env');

const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
