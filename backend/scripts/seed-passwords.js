/**
 * Replaces the placeholder hashes in the seeded users with real bcrypt hashes.
 * Run once after importing schema.sql:   npm run seed:passwords
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// schema.sql creates only the admin. The cashier entries here are for people
// who also ran the optional seed-demo.sql — they are skipped otherwise.
const ACCOUNTS = [
  { username: 'admin', password: 'admin123' },
  { username: 'cashier1', password: 'cashier123' },
  { username: 'cashier2', password: 'cashier123' },
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  for (const { username, password } of ACCOUNTS) {
    const hash = bcrypt.hashSync(password, 10);
    const [r] = await conn.execute('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username]);
    console.log(r.affectedRows ? `  ok  ${username} -> ${password}` : `  skip ${username} (not found)`);
  }

  console.log('\nDone. CHANGE THESE PASSWORDS before showing this to anyone real.');
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
